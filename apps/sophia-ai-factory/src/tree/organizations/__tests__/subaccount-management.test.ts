/**
 * Subaccount Management & MCU Allocation Test Suite
 *
 * Validates:
 * - Subaccount CRUD, custom domain resolution, and slug uniqueness per agency
 * - Whitelabel client branding persistence
 * - Subaccount RBAC membership roles (agency_owner, video_editor, client_reviewer)
 * - MCU quota allocation, atomic deductions, guard checks, and monthly resets
 *
 * Layer: tree/organizations/__tests__
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@/seed/db/client';
import {
  createSubaccount,
  getSubaccountById,
  getSubaccountBySlug,
  listSubaccountsByOrg,
  updateSubaccount,
  archiveSubaccount,
  getSubaccountByCustomDomain,
  getSubaccountBranding,
  upsertSubaccountBranding,
  addSubaccountMember,
  getSubaccountMember,
  listSubaccountMembers,
  removeSubaccountMember,
  slugify,
} from '../subaccount-repo';
import {
  allocateSubaccountMcu,
  checkSubaccountQuota,
  deductSubaccountMcu,
  getSubaccountMcuBalance,
  resetSubaccountMcuUsage,
} from '../mcu-allocation-engine';

function createTestD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  // Base tables required for foreign key resolution
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE
    );

    CREATE TABLE IF NOT EXISTS client_subaccounts (
      id TEXT PRIMARY KEY,
      agency_org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      custom_domain TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (lower(status) IN ('active', 'suspended', 'archived')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (agency_org_id, slug)
    );

    CREATE TABLE IF NOT EXISTS subaccount_branding (
      subaccount_id TEXT PRIMARY KEY REFERENCES client_subaccounts(id) ON DELETE CASCADE,
      logo_url TEXT,
      primary_color TEXT DEFAULT '#0f172a',
      accent_color TEXT DEFAULT '#10b981',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subaccount_mcu_allocations (
      id TEXT PRIMARY KEY,
      subaccount_id TEXT NOT NULL REFERENCES client_subaccounts(id) ON DELETE CASCADE,
      allocated_mcu INTEGER NOT NULL DEFAULT 0,
      used_mcu INTEGER NOT NULL DEFAULT 0,
      period_start TEXT,
      period_end TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (subaccount_id)
    );

    CREATE TABLE IF NOT EXISTS subaccount_members (
      id TEXT PRIMARY KEY,
      subaccount_id TEXT NOT NULL REFERENCES client_subaccounts(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK (lower(role) IN ('agency_owner', 'video_editor', 'client_reviewer')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (subaccount_id, user_id)
    );
  `);

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      return {
        bind(...vals: unknown[]) {
          bound = vals;
          return this;
        },
        async run(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const res = stmt.run(...params);
          return {
            success: true,
            meta: { changes: res.changes, duration: 1 },
            changes: res.changes,
            lastInsertRowid: res.lastInsertRowid,
          };
        },
        async all(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...params);
          return {
            results,
            meta: { changes: 0, duration: 1 },
          };
        },
        async first(...vals: unknown[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...params);
          return row ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

describe('Subaccount Management & MCU Allocation', () => {
  let db: D1Database;
  const AGENCY_A = 'org_agency_alpha';
  const AGENCY_B = 'org_agency_beta';

  beforeEach(async () => {
    db = createTestD1();

    // Seed test agencies and users
    await db
      .prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?), (?, ?, ?)')
      .bind(AGENCY_A, 'Alpha Media Agency', 'alpha-media', AGENCY_B, 'Beta Creative Lab', 'beta-creative')
      .run();

    await db
      .prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)')
      .bind(
        'usr_owner', 'Agency Owner', 'owner@agencyalpha.com',
        'usr_editor', 'Video Editor', 'editor@agencyalpha.com',
        'usr_client', 'Brand Stakeholder', 'client@brandalpha.com'
      )
      .run();
  });

  describe('slugify helper', () => {
    it('normalizes Vietnamese diacritics and special characters', () => {
      expect(slugify('Thương Hiệu Thời Trang Á Châu')).toBe('thuong-hieu-thoi-trang-a-chau');
      expect(slugify('Công Ty Cổ Phần Mỹ Phẩm Sài Gòn & Co.')).toBe('cong-ty-co-phan-my-pham-sai-gon-co');
      expect(slugify('   Agency Brand 100%   ')).toBe('agency-brand-100');
    });

    it('falls back to default slug if input is empty or symbols only', () => {
      expect(slugify('')).toBe('subaccount');
      expect(slugify('!!!')).toBe('subaccount');
    });
  });

  describe('Subaccount Repository CRUD', () => {
    it('creates a client subaccount with auto-generated slug and branding', async () => {
      const sub = await createSubaccount(db, {
        agencyOrgId: AGENCY_A,
        name: 'Brand Alpha Studio',
        customDomain: 'review.brandalpha.com',
        branding: {
          logoUrl: 'https://cdn.brandalpha.com/logo.png',
          primaryColor: '#1e293b',
          accentColor: '#06b6d4',
        },
        initialMcu: 1000,
      });

      expect(sub.id).toMatch(/^sub_/);
      expect(sub.agencyOrgId).toBe(AGENCY_A);
      expect(sub.name).toBe('Brand Alpha Studio');
      expect(sub.slug).toBe('brand-alpha-studio');
      expect(sub.customDomain).toBe('review.brandalpha.com');
      expect(sub.status).toBe('ACTIVE');
      expect(sub.branding.logoUrl).toBe('https://cdn.brandalpha.com/logo.png');
      expect(sub.branding.primaryColor).toBe('#1e293b');
      expect(sub.branding.accentColor).toBe('#06b6d4');
      expect(sub.mcuQuota.allocated).toBe(1000);
      expect(sub.mcuQuota.used).toBe(0);
      expect(sub.mcuQuota.remaining).toBe(1000);
    });

    it('enforces slug uniqueness within the same agency organization', async () => {
      await createSubaccount(db, {
        agencyOrgId: AGENCY_A,
        name: 'Delta Corp',
        slug: 'delta-corp',
      });

      await expect(
        createSubaccount(db, {
          agencyOrgId: AGENCY_A,
          name: 'Delta Corporation',
          slug: 'delta-corp',
        })
      ).rejects.toThrow(/SUBACCOUNT_SLUG_CONFLICT/);
    });

    it('allows identical slugs across different agencies', async () => {
      const subA = await createSubaccount(db, {
        agencyOrgId: AGENCY_A,
        name: 'Eco Brand',
        slug: 'eco-brand',
      });

      const subB = await createSubaccount(db, {
        agencyOrgId: AGENCY_B,
        name: 'Eco Brand',
        slug: 'eco-brand',
      });

      expect(subA.id).not.toBe(subB.id);
      expect(subA.slug).toBe('eco-brand');
      expect(subB.slug).toBe('eco-brand');
      expect(subA.agencyOrgId).toBe(AGENCY_A);
      expect(subB.agencyOrgId).toBe(AGENCY_B);
    });

    it('fails when agencyOrgId or name is missing', async () => {
      await expect(
        createSubaccount(db, { agencyOrgId: '', name: 'Test' })
      ).rejects.toThrow(/VALIDATION_ERROR/);

      await expect(
        createSubaccount(db, { agencyOrgId: AGENCY_A, name: '  ' })
      ).rejects.toThrow(/VALIDATION_ERROR/);
    });

    it('retrieves subaccount by id and by slug', async () => {
      const created = await createSubaccount(db, {
        agencyOrgId: AGENCY_A,
        name: 'Mega Retailer',
        slug: 'mega-retailer',
      });

      const byId = await getSubaccountById(db, created.id);
      expect(byId).not.toBeNull();
      expect(byId?.name).toBe('Mega Retailer');

      const bySlug = await getSubaccountBySlug(db, AGENCY_A, 'mega-retailer');
      expect(bySlug).not.toBeNull();
      expect(bySlug?.id).toBe(created.id);

      const wrongSlug = await getSubaccountBySlug(db, AGENCY_B, 'mega-retailer');
      expect(wrongSlug).toBeNull();
    });

    it('lists subaccounts belonging to a specific agency only', async () => {
      await createSubaccount(db, { agencyOrgId: AGENCY_A, name: 'Client 1' });
      await createSubaccount(db, { agencyOrgId: AGENCY_A, name: 'Client 2' });
      await createSubaccount(db, { agencyOrgId: AGENCY_B, name: 'Client 3' });

      const listA = await listSubaccountsByOrg(db, AGENCY_A);
      expect(listA.length).toBe(2);
      expect(listA.every((s) => s.agencyOrgId === AGENCY_A)).toBe(true);

      const listB = await listSubaccountsByOrg(db, AGENCY_B);
      expect(listB.length).toBe(1);
      expect(listB[0].agencyOrgId).toBe(AGENCY_B);
    });

    it('resolves subaccount by custom domain', async () => {
      const sub = await createSubaccount(db, {
        agencyOrgId: AGENCY_A,
        name: 'FinTech Pro',
        customDomain: 'portal.fintechpro.vn',
      });

      const found = await getSubaccountByCustomDomain(db, 'portal.fintechpro.vn');
      expect(found).not.toBeNull();
      expect(found?.id).toBe(sub.id);

      // Case-insensitive & trimmed matching
      const caseFound = await getSubaccountByCustomDomain(db, '  PORTAL.FINTECHPRO.VN  ');
      expect(caseFound?.id).toBe(sub.id);

      const notFound = await getSubaccountByCustomDomain(db, 'other.domain.com');
      expect(notFound).toBeNull();
    });

    it('updates subaccount attributes and prevents duplicate slug conflicts', async () => {
      const sub1 = await createSubaccount(db, { agencyOrgId: AGENCY_A, name: 'Client 1', slug: 'client-1' });
      const sub2 = await createSubaccount(db, { agencyOrgId: AGENCY_A, name: 'Client 2', slug: 'client-2' });

      // Updating name and custom domain succeeds
      const updated = await updateSubaccount(db, sub1.id, {
        name: 'Client 1 Renamed',
        customDomain: 'review.client1.com',
      });
      expect(updated.name).toBe('Client 1 Renamed');
      expect(updated.customDomain).toBe('review.client1.com');

      // Changing slug to already used slug throws conflict
      await expect(
        updateSubaccount(db, sub2.id, { slug: 'client-1' })
      ).rejects.toThrow(/SUBACCOUNT_SLUG_CONFLICT/);
    });

    it('archives subaccount and updates status', async () => {
      const sub = await createSubaccount(db, { agencyOrgId: AGENCY_A, name: 'Archived Client' });
      expect(sub.status).toBe('ACTIVE');

      await archiveSubaccount(db, sub.id);
      const reloaded = await getSubaccountById(db, sub.id);
      expect(reloaded?.status).toBe('SUSPENDED');

      // Archived subaccount is not resolved via active custom domain search
      if (sub.customDomain) {
        const domainLookup = await getSubaccountByCustomDomain(db, sub.customDomain);
        expect(domainLookup).toBeNull();
      }
    });
  });

  describe('Branding Customization', () => {
    it('manages subaccount branding lifecycle (upsert and fetch)', async () => {
      const sub = await createSubaccount(db, { agencyOrgId: AGENCY_A, name: 'Branded Co' });

      // Initial state without custom branding
      const initial = await getSubaccountBranding(db, sub.id);
      expect(initial).toBeNull();

      // Upsert new branding
      const saved = await upsertSubaccountBranding(db, sub.id, {
        logoUrl: 'https://brand.com/logo.svg',
        primaryColor: '#09090b',
        accentColor: '#f59e0b',
      });
      expect(saved.logoUrl).toBe('https://brand.com/logo.svg');
      expect(saved.primaryColor).toBe('#09090b');
      expect(saved.accentColor).toBe('#f59e0b');

      // Update partial branding preserves existing
      const partialUpdated = await upsertSubaccountBranding(db, sub.id, {
        accentColor: '#10b981',
      });
      expect(partialUpdated.logoUrl).toBe('https://brand.com/logo.svg');
      expect(partialUpdated.primaryColor).toBe('#09090b');
      expect(partialUpdated.accentColor).toBe('#10b981');
    });
  });

  describe('Subaccount RBAC Membership', () => {
    it('manages team members per subaccount with distinct roles', async () => {
      const sub = await createSubaccount(db, { agencyOrgId: AGENCY_A, name: 'RBAC Brand' });

      // Add Agency Owner
      const member1 = await addSubaccountMember(db, sub.id, 'usr_owner', 'agency_owner');
      expect(member1.role).toBe('agency_owner');

      // Add Video Editor
      const member2 = await addSubaccountMember(db, sub.id, 'usr_editor', 'video_editor');
      expect(member2.role).toBe('video_editor');

      // Add Client Reviewer
      const member3 = await addSubaccountMember(db, sub.id, 'usr_client', 'client_reviewer');
      expect(member3.role).toBe('client_reviewer');

      // List members
      const members = await listSubaccountMembers(db, sub.id);
      expect(members.length).toBe(3);

      // Verify specific member
      const checkEditor = await getSubaccountMember(db, sub.id, 'usr_editor');
      expect(checkEditor?.role).toBe('video_editor');

      // Role upgrade (update on conflict)
      await addSubaccountMember(db, sub.id, 'usr_editor', 'agency_owner');
      const upgradedEditor = await getSubaccountMember(db, sub.id, 'usr_editor');
      expect(upgradedEditor?.role).toBe('agency_owner');

      // Remove member
      await removeSubaccountMember(db, sub.id, 'usr_client');
      const removedCheck = await getSubaccountMember(db, sub.id, 'usr_client');
      expect(removedCheck).toBeNull();
    });
  });

  describe('MCU Allocation Engine', () => {
    it('allocates MCU quota and reports correct balance', async () => {
      const sub = await createSubaccount(db, { agencyOrgId: AGENCY_A, name: 'MCU Client' });

      const allocation = await allocateSubaccountMcu(db, {
        subaccountId: sub.id,
        allocatedMcu: 500,
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-30T23:59:59Z',
      });

      expect(allocation.allocatedMcu).toBe(500);
      expect(allocation.usedMcu).toBe(0);
      expect(allocation.remainingMcu).toBe(500);

      const balance = await getSubaccountMcuBalance(db, sub.id);
      expect(balance.allocated).toBe(500);
      expect(balance.remaining).toBe(500);
    });

    it('rejects negative MCU allocations', async () => {
      const sub = await createSubaccount(db, { agencyOrgId: AGENCY_A, name: 'Negative MCU Test' });

      await expect(
        allocateSubaccountMcu(db, {
          subaccountId: sub.id,
          allocatedMcu: -100,
        })
      ).rejects.toThrow(/VALIDATION_ERROR/);
    });

    it('enforces quota guard check and detects quota exhaustion', async () => {
      const sub = await createSubaccount(db, {
        agencyOrgId: AGENCY_A,
        name: 'Quota Check Co',
        initialMcu: 100,
      });

      // Check within quota
      const check1 = await checkSubaccountQuota(db, sub.id, 50);
      expect(check1.isAllowed).toBe(true);
      expect(check1.remainingMcu).toBe(100);

      // Check exact quota
      const checkExact = await checkSubaccountQuota(db, sub.id, 100);
      expect(checkExact.isAllowed).toBe(true);

      // Check overage
      const checkExceeded = await checkSubaccountQuota(db, sub.id, 101);
      expect(checkExceeded.isAllowed).toBe(false);
      expect(checkExceeded.reason).toMatch(/MCU_QUOTA_EXCEEDED/);
    });

    it('returns isAllowed false when checking quota on subaccount with no allocation', async () => {
      const sub = await createSubaccount(db, { agencyOrgId: AGENCY_A, name: 'Unallocated Co' });

      const check = await checkSubaccountQuota(db, sub.id, 10);
      expect(check.isAllowed).toBe(false);
      expect(check.reason).toMatch(/NO_ALLOCATION_FOUND/);
    });

    it('atomically deducts MCU credits and enforces quota ceiling', async () => {
      const sub = await createSubaccount(db, {
        agencyOrgId: AGENCY_A,
        name: 'Deduction Co',
        initialMcu: 250,
      });

      // First deduction: 100 MCU
      const deduct1 = await deductSubaccountMcu(db, {
        subaccountId: sub.id,
        amount: 100,
        videoId: 'vid_001',
        reason: 'Render 1080p video',
      });
      expect(deduct1.success).toBe(true);
      expect(deduct1.newUsedMcu).toBe(100);
      expect(deduct1.remainingMcu).toBe(150);

      // Second deduction: 150 MCU (uses exact remaining)
      const deduct2 = await deductSubaccountMcu(db, {
        subaccountId: sub.id,
        amount: 150,
        videoId: 'vid_002',
      });
      expect(deduct2.success).toBe(true);
      expect(deduct2.newUsedMcu).toBe(250);
      expect(deduct2.remainingMcu).toBe(0);

      // Third deduction: 1 MCU (exceeds quota -> throws)
      await expect(
        deductSubaccountMcu(db, {
          subaccountId: sub.id,
          amount: 1,
        })
      ).rejects.toThrow(/MCU_QUOTA_EXCEEDED/);
    });

    it('resets used MCU credits on new billing cycle', async () => {
      const sub = await createSubaccount(db, {
        agencyOrgId: AGENCY_A,
        name: 'Reset Co',
        initialMcu: 300,
      });

      await deductSubaccountMcu(db, { subaccountId: sub.id, amount: 200 });
      const beforeReset = await getSubaccountMcuBalance(db, sub.id);
      expect(beforeReset.used).toBe(200);
      expect(beforeReset.remaining).toBe(100);

      const afterReset = await resetSubaccountMcuUsage(db, sub.id);
      expect(afterReset.usedMcu).toBe(0);
      expect(afterReset.remainingMcu).toBe(300);
    });
  });
});

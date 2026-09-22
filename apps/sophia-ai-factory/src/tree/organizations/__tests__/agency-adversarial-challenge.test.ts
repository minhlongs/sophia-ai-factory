/**
 * Milestone 2 Adversarial Stress Test Suite:
 * - Concurrent MCU Quota Deductions (Zero negative balance, strict quota enforcement)
 * - Multi-Tenancy & Subaccount Isolation across different Agency Organizations
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
  upsertSubaccountBranding,
  getSubaccountBranding,
  addSubaccountMember,
  getSubaccountMember,
  listSubaccountMembers,
} from '../subaccount-repo';
import {
  allocateSubaccountMcu,
  checkSubaccountQuota,
  deductSubaccountMcu,
  getSubaccountMcuBalance,
} from '../mcu-allocation-engine';
import {
  createVideoReviewLink,
  resolveReviewByToken,
} from '../review-service';

function createAdversarialD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

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

    CREATE TABLE IF NOT EXISTS video_reviews (
      id TEXT PRIMARY KEY,
      subaccount_id TEXT NOT NULL REFERENCES client_subaccounts(id) ON DELETE CASCADE,
      video_id TEXT NOT NULL,
      video_title TEXT,
      video_url TEXT,
      token_hash TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (lower(status) IN ('pending', 'approved', 'changes_requested')),
      feedback_comments TEXT NOT NULL DEFAULT '[]',
      reviewed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
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
            meta: { changes: Number(res.changes), duration: 1 },
            changes: Number(res.changes),
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

describe('Milestone 2 Adversarial Stress Testing', () => {
  let db: D1Database;
  const AGENCY_ALPHA = 'org_agency_alpha';
  const AGENCY_BETA = 'org_agency_beta';

  beforeEach(async () => {
    db = createAdversarialD1();

    await db
      .prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?), (?, ?, ?)')
      .bind(AGENCY_ALPHA, 'Agency Alpha', 'agency-alpha', AGENCY_BETA, 'Agency Beta', 'agency-beta')
      .run();

    await db
      .prepare('INSERT INTO users (id, name, email) VALUES (?, ?, ?), (?, ?, ?)')
      .bind(
        'usr_alpha_lead', 'Alpha Lead', 'lead@alpha.com',
        'usr_beta_lead', 'Beta Lead', 'lead@beta.com'
      )
      .run();
  });

  describe('Adversarial Challenge 1: MCU Quota Allocation & Concurrent Deductions', () => {
    it('simulates 20 concurrent deductions on limited balance (100 MCU, 20x 10 MCU): exactly 10 succeed, 10 fail, zero over-allocation', async () => {
      const sub = await createSubaccount(db, {
        agencyOrgId: AGENCY_ALPHA,
        name: 'High-Concurrency Client',
        initialMcu: 100,
      });

      // Fire 20 concurrent deduction calls of 10 MCU each
      const deductionPromises = Array.from({ length: 20 }, (_, i) =>
        deductSubaccountMcu(db, {
          subaccountId: sub.id,
          amount: 10,
          videoId: `vid_concurrent_${i}`,
          reason: `Concurrent render job #${i}`,
        })
      );

      const results = await Promise.allSettled(deductionPromises);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // Invariant 1: Exactly 10 requests must succeed (10 * 10 = 100 MCU)
      expect(fulfilled).toHaveLength(10);

      // Invariant 2: Exactly 10 requests must fail
      expect(rejected).toHaveLength(10);

      // Invariant 3: All failures must be MCU_QUOTA_EXCEEDED errors
      for (const rej of rejected) {
        expect((rej as PromiseRejectedResult).reason.message).toMatch(/MCU_QUOTA_EXCEEDED/);
      }

      // Invariant 4: Database state verification — zero negative balance, exactly 100 used, 0 remaining
      const finalBalance = await getSubaccountMcuBalance(db, sub.id);
      expect(finalBalance.allocated).toBe(100);
      expect(finalBalance.used).toBe(100);
      expect(finalBalance.remaining).toBe(0);

      // Invariant 5: Any further deduction must fail immediately
      await expect(
        deductSubaccountMcu(db, {
          subaccountId: sub.id,
          amount: 1,
        })
      ).rejects.toThrow(/MCU_QUOTA_EXCEEDED/);
    });

    it('stress-tests 50 concurrent deductions with random credit loads against 300 MCU pool', async () => {
      const sub = await createSubaccount(db, {
        agencyOrgId: AGENCY_ALPHA,
        name: 'Randomized Load Client',
        initialMcu: 300,
      });

      // Randomized deduction requests between 10 and 30 MCU
      const amounts = [
        15, 20, 25, 10, 30, 15, 20, 10, 25, 30,
        10, 20, 15, 25, 20, 10, 30, 15, 25, 20,
        15, 10, 25, 20, 30, 10, 15, 20, 25, 10,
        20, 15, 30, 25, 10, 20, 15, 10, 25, 30,
        15, 20, 10, 25, 30, 15, 20, 10, 25, 20,
      ];
      expect(amounts).toHaveLength(50);
      const totalRequested = amounts.reduce((a, b) => a + b, 0);
      expect(totalRequested).toBeGreaterThan(300); // 950 MCU requested > 300 MCU pool

      const results = await Promise.allSettled(
        amounts.map((amount, idx) =>
          deductSubaccountMcu(db, {
            subaccountId: sub.id,
            amount,
            videoId: `vid_random_${idx}`,
          })
        )
      );

      let totalDeductedBySuccessful = 0;
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') {
          totalDeductedBySuccessful += amounts[idx];
        } else {
          expect((r as PromiseRejectedResult).reason.message).toMatch(/MCU_QUOTA_EXCEEDED/);
        }
      });

      const finalBalance = await getSubaccountMcuBalance(db, sub.id);

      // Empirical assertions:
      expect(totalDeductedBySuccessful).toBeLessThanOrEqual(300);
      expect(finalBalance.used).toBe(totalDeductedBySuccessful);
      expect(finalBalance.remaining).toBe(300 - totalDeductedBySuccessful);
      expect(finalBalance.remaining).toBeGreaterThanOrEqual(0);
      expect(finalBalance.used).toBeLessThanOrEqual(finalBalance.allocated);
    });

    it('rejects invalid deduction inputs (amount <= 0 or non-existent subaccount) without corrupting balance', async () => {
      const sub = await createSubaccount(db, {
        agencyOrgId: AGENCY_ALPHA,
        name: 'Input Validation Client',
        initialMcu: 50,
      });

      // Amount = 0
      await expect(
        deductSubaccountMcu(db, { subaccountId: sub.id, amount: 0 })
      ).rejects.toThrow(/VALIDATION_ERROR/);

      // Negative amount
      await expect(
        deductSubaccountMcu(db, { subaccountId: sub.id, amount: -25 })
      ).rejects.toThrow(/VALIDATION_ERROR/);

      // Non-existent subaccount
      await expect(
        deductSubaccountMcu(db, { subaccountId: 'sub_non_existent', amount: 10 })
      ).rejects.toThrow(/NO_ALLOCATION_FOUND/);

      // Balance untouched
      const balance = await getSubaccountMcuBalance(db, sub.id);
      expect(balance.allocated).toBe(50);
      expect(balance.used).toBe(0);
      expect(balance.remaining).toBe(50);
    });

    it('pre-flight quota check adheres to exact boundary conditions', async () => {
      const sub = await createSubaccount(db, {
        agencyOrgId: AGENCY_ALPHA,
        name: 'Preflight Boundary Client',
        initialMcu: 50,
      });

      // Check remaining 50
      const checkFull = await checkSubaccountQuota(db, sub.id, 50);
      expect(checkFull.isAllowed).toBe(true);
      expect(checkFull.remainingMcu).toBe(50);

      // Check 51 (exceeded)
      const checkOver = await checkSubaccountQuota(db, sub.id, 51);
      expect(checkOver.isAllowed).toBe(false);
      expect(checkOver.reason).toMatch(/MCU_QUOTA_EXCEEDED/);

      // Negative requestedMcu
      await expect(checkSubaccountQuota(db, sub.id, -5)).rejects.toThrow(/VALIDATION_ERROR/);
    });
  });

  describe('Adversarial Challenge 2: Multi-Tenancy & Subaccount Isolation', () => {
    it('enforces complete tenant isolation between Agency Alpha and Agency Beta', async () => {
      // 1. Create subaccounts under Agency Alpha
      const alphaSub1 = await createSubaccount(db, {
        agencyOrgId: AGENCY_ALPHA,
        name: 'Alpha Fashion',
        slug: 'fashion-brand',
        initialMcu: 500,
        branding: {
          logoUrl: 'https://alpha.com/logo.png',
          primaryColor: '#1e3a8a',
          accentColor: '#3b82f6',
        },
      });

      const alphaSub2 = await createSubaccount(db, {
        agencyOrgId: AGENCY_ALPHA,
        name: 'Alpha Electronics',
        slug: 'electronics-brand',
        initialMcu: 200,
      });

      // 2. Create subaccount under Agency Beta with SAME slug 'fashion-brand'
      const betaSub1 = await createSubaccount(db, {
        agencyOrgId: AGENCY_BETA,
        name: 'Beta Fashion Co',
        slug: 'fashion-brand', // Identical slug in another agency must be permitted
        initialMcu: 300,
        branding: {
          logoUrl: 'https://beta.com/logo.png',
          primaryColor: '#701a75',
          accentColor: '#d946ef',
        },
      });

      // Invariant 1: IDs are unique across tenants
      expect(alphaSub1.id).not.toBe(betaSub1.id);

      // Invariant 2: listSubaccountsByOrg strictly filters by agencyOrgId
      const alphaList = await listSubaccountsByOrg(db, AGENCY_ALPHA);
      expect(alphaList).toHaveLength(2);
      expect(alphaList.map((s) => s.id).sort()).toEqual([alphaSub1.id, alphaSub2.id].sort());
      expect(alphaList.every((s) => s.agencyOrgId === AGENCY_ALPHA)).toBe(true);

      const betaList = await listSubaccountsByOrg(db, AGENCY_BETA);
      expect(betaList).toHaveLength(1);
      expect(betaList[0].id).toBe(betaSub1.id);
      expect(betaList[0].agencyOrgId).toBe(AGENCY_BETA);

      // Invariant 3: getSubaccountBySlug isolates by agencyOrgId
      const alphaLookup = await getSubaccountBySlug(db, AGENCY_ALPHA, 'fashion-brand');
      expect(alphaLookup?.id).toBe(alphaSub1.id);
      expect(alphaLookup?.name).toBe('Alpha Fashion');

      const betaLookup = await getSubaccountBySlug(db, AGENCY_BETA, 'fashion-brand');
      expect(betaLookup?.id).toBe(betaSub1.id);
      expect(betaLookup?.name).toBe('Beta Fashion Co');

      // Agency Alpha cannot access Beta's subaccount by slug
      const crossLookupAlpha = await getSubaccountBySlug(db, AGENCY_ALPHA, 'non-existent-in-alpha');
      expect(crossLookupAlpha).toBeNull();

      // Agency Beta cannot find Alpha's electronics brand
      const crossLookupBeta = await getSubaccountBySlug(db, AGENCY_BETA, 'electronics-brand');
      expect(crossLookupBeta).toBeNull();
    });

    it('guarantees MCU quota deduction isolation across agency subaccounts', async () => {
      const alphaSub = await createSubaccount(db, {
        agencyOrgId: AGENCY_ALPHA,
        name: 'Alpha Quota Account',
        initialMcu: 100,
      });

      const betaSub = await createSubaccount(db, {
        agencyOrgId: AGENCY_BETA,
        name: 'Beta Quota Account',
        initialMcu: 100,
      });

      // Deduct all 100 MCU from Alpha
      await deductSubaccountMcu(db, {
        subaccountId: alphaSub.id,
        amount: 100,
      });

      const alphaBal = await getSubaccountMcuBalance(db, alphaSub.id);
      expect(alphaBal.used).toBe(100);
      expect(alphaBal.remaining).toBe(0);

      // Verify Beta's balance is 100% intact and untouched
      const betaBal = await getSubaccountMcuBalance(db, betaSub.id);
      expect(betaBal.allocated).toBe(100);
      expect(betaBal.used).toBe(0);
      expect(betaBal.remaining).toBe(100);

      // Deducting on exhausted Alpha throws, but Beta can deduct freely
      await expect(
        deductSubaccountMcu(db, { subaccountId: alphaSub.id, amount: 1 })
      ).rejects.toThrow(/MCU_QUOTA_EXCEEDED/);

      const betaDeduct = await deductSubaccountMcu(db, { subaccountId: betaSub.id, amount: 50 });
      expect(betaDeduct.success).toBe(true);
      expect(betaDeduct.remainingMcu).toBe(50);
    });

    it('isolates subaccount RBAC team memberships across tenants', async () => {
      const alphaSub = await createSubaccount(db, {
        agencyOrgId: AGENCY_ALPHA,
        name: 'Alpha RBAC',
      });

      const betaSub = await createSubaccount(db, {
        agencyOrgId: AGENCY_BETA,
        name: 'Beta RBAC',
      });

      // Add members to Alpha
      await addSubaccountMember(db, alphaSub.id, 'usr_alpha_lead', 'agency_owner');

      // Add members to Beta
      await addSubaccountMember(db, betaSub.id, 'usr_beta_lead', 'video_editor');

      // Members in Alpha
      const alphaMembers = await listSubaccountMembers(db, alphaSub.id);
      expect(alphaMembers).toHaveLength(1);
      expect(alphaMembers[0].userId).toBe('usr_alpha_lead');
      expect(alphaMembers[0].role).toBe('agency_owner');

      // Members in Beta
      const betaMembers = await listSubaccountMembers(db, betaSub.id);
      expect(betaMembers).toHaveLength(1);
      expect(betaMembers[0].userId).toBe('usr_beta_lead');
      expect(betaMembers[0].role).toBe('video_editor');

      // Cross-tenant member checks
      const alphaCheckBetaUser = await getSubaccountMember(db, alphaSub.id, 'usr_beta_lead');
      expect(alphaCheckBetaUser).toBeNull();

      const betaCheckAlphaUser = await getSubaccountMember(db, betaSub.id, 'usr_alpha_lead');
      expect(betaCheckAlphaUser).toBeNull();
    });

    it('isolates tokenized video review links and whitelabel client branding per tenant', async () => {
      const alphaSub = await createSubaccount(db, {
        agencyOrgId: AGENCY_ALPHA,
        name: 'Alpha Luxury Brand',
        branding: {
          logoUrl: 'https://cdn.alpha.com/logo.svg',
          primaryColor: '#4c1d95',
          accentColor: '#a855f7',
        },
      });

      const betaSub = await createSubaccount(db, {
        agencyOrgId: AGENCY_BETA,
        name: 'Beta Sportswear',
        branding: {
          logoUrl: 'https://cdn.beta.com/logo.svg',
          primaryColor: '#064e3b',
          accentColor: '#10b981',
        },
      });

      // Create review link for Alpha
      const alphaReview = await createVideoReviewLink(db, {
        subaccountId: alphaSub.id,
        videoId: 'vid_alpha_01',
        videoTitle: 'Alpha Autumn Campaign',
      });

      // Create review link for Beta
      const betaReview = await createVideoReviewLink(db, {
        subaccountId: betaSub.id,
        videoId: 'vid_beta_01',
        videoTitle: 'Beta Winter Drop',
      });

      // Resolving Alpha review yields Alpha branding only
      const alphaPayload = await resolveReviewByToken(db, alphaReview.rawToken);
      expect(alphaPayload.subaccountId).toBe(alphaSub.id);
      expect(alphaPayload.subaccountBranding?.clientName).toBe('Alpha Luxury Brand');
      expect(alphaPayload.subaccountBranding?.logoUrl).toBe('https://cdn.alpha.com/logo.svg');
      expect(alphaPayload.subaccountBranding?.primaryColor).toBe('#4c1d95');

      // Resolving Beta review yields Beta branding only
      const betaPayload = await resolveReviewByToken(db, betaReview.rawToken);
      expect(betaPayload.subaccountId).toBe(betaSub.id);
      expect(betaPayload.subaccountBranding?.clientName).toBe('Beta Sportswear');
      expect(betaPayload.subaccountBranding?.logoUrl).toBe('https://cdn.beta.com/logo.svg');
      expect(betaPayload.subaccountBranding?.primaryColor).toBe('#064e3b');
    });

    it('isolates custom domains and ensures suspension does not bleed across tenants', async () => {
      const alphaSub = await createSubaccount(db, {
        agencyOrgId: AGENCY_ALPHA,
        name: 'Alpha Domain Client',
        customDomain: 'review.alphaclient.com',
      });

      const betaSub = await createSubaccount(db, {
        agencyOrgId: AGENCY_BETA,
        name: 'Beta Domain Client',
        customDomain: 'review.betaclient.com',
      });

      // Both domains resolve when active
      const resAlpha = await getSubaccountByCustomDomain(db, 'review.alphaclient.com');
      const resBeta = await getSubaccountByCustomDomain(db, 'review.betaclient.com');
      expect(resAlpha?.id).toBe(alphaSub.id);
      expect(resBeta?.id).toBe(betaSub.id);

      // Archive/suspend Alpha subaccount
      await archiveSubaccount(db, alphaSub.id);

      // Alpha domain resolution fails
      const suspendedAlpha = await getSubaccountByCustomDomain(db, 'review.alphaclient.com');
      expect(suspendedAlpha).toBeNull();

      // Beta domain resolution remains fully functional
      const activeBeta = await getSubaccountByCustomDomain(db, 'review.betaclient.com');
      expect(activeBeta?.id).toBe(betaSub.id);
      expect(activeBeta?.status).toBe('ACTIVE');
    });
  });
});

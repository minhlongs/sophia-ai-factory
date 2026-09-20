/**
 * Integration Test Suite: Tenant Context Switching & Data Isolation Guard
 *
 * Validates:
 * 1. Multi-organization membership verification and context switching
 * 2. Unauthorized context assertion rejection (security boundary)
 * 3. Synchronous tenant scope assertions (assertTenantScope)
 * 4. Resource scope assertion and tenant list filtering
 *
 * @module __tests__/integration/enterprise/tenant-isolation-integration.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import {
  switchActiveOrg,
  validateOrgMembership,
  listUserOrganizations,
  OrgContextError,
} from '@/forest/tenant/context-switcher';
import {
  assertTenantScope,
  assertResourceScope,
  filterByTenant,
  CrossTenantViolationError,
} from '@/forest/tenant/isolation-guard';
import { makeD1 } from '@/__tests__/integration/shared-d1-shim';

const req = createRequire(import.meta.url);
const { DatabaseSync } = req('node:sqlite') as {
  DatabaseSync: new (path: string) => any;
};

describe('Tenant Isolation & Context Switcher Integration Suite', () => {
  let rawDb: any;
  let db: any;
  const userAlpha = 'usr_alpha_multi';

  beforeEach(() => {
    rawDb = new DatabaseSync(':memory:');
    rawDb.exec(`
      CREATE TABLE organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        tier TEXT NOT NULL DEFAULT 'pro',
        max_seats INTEGER NOT NULL DEFAULT 5,
        status TEXT NOT NULL DEFAULT 'active'
      );

      CREATE TABLE organization_members (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE (org_id, user_id)
      );

      CREATE VIEW IF NOT EXISTS org_members AS SELECT * FROM organization_members;

      -- Org 1: Alpha Media (userAlpha is owner)
      INSERT INTO organizations (id, name, slug, tier, max_seats)
      VALUES ('org_alpha', 'Alpha Media', 'alpha-media', 'pro', 5);

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
      VALUES ('mem_1', 'org_alpha', '${userAlpha}', 'owner', 1000, 1000);

      -- Org 2: Beta Studio (userAlpha is creator)
      INSERT INTO organizations (id, name, slug, tier, max_seats)
      VALUES ('org_beta', 'Beta Studio', 'beta-studio', 'starter', 1);

      INSERT INTO organization_members (id, org_id, user_id, role, created_at, updated_at)
      VALUES ('mem_2', 'org_beta', '${userAlpha}', 'creator', 2000, 2000);

      -- Org 3: Secret Org (userAlpha has NO membership)
      INSERT INTO organizations (id, name, slug, tier, max_seats)
      VALUES ('org_secret', 'Secret Org', 'secret-org', 'master', 999);
    `);
    db = makeD1(rawDb);
  });

  describe('Context Switcher & Membership Validation', () => {
    it('validates membership across multiple organizations', async () => {
      const valAlpha = await validateOrgMembership(userAlpha, 'org_alpha', db);
      expect(valAlpha.isMember).toBe(true);
      expect(valAlpha.role).toBe('owner');
      expect(valAlpha.org?.name).toBe('Alpha Media');

      const valBeta = await validateOrgMembership(userAlpha, 'org_beta', db);
      expect(valBeta.isMember).toBe(true);
      expect(valBeta.role).toBe('creator');
      expect(valBeta.org?.name).toBe('Beta Studio');

      const valSecret = await validateOrgMembership(userAlpha, 'org_secret', db);
      expect(valSecret.isMember).toBe(false);
      expect(valSecret.role).toBeNull();
    });

    it('switches active organization context cleanly when user has membership', async () => {
      const contextBeta = await switchActiveOrg(userAlpha, 'org_beta', db);
      expect(contextBeta.orgId).toBe('org_beta');
      expect(contextBeta.role).toBe('creator');
      expect(contextBeta.orgName).toBe('Beta Studio');
    });

    it('rejects context switch to an organization where user has no membership', async () => {
      await expect(
        switchActiveOrg(userAlpha, 'org_secret', db),
      ).rejects.toThrow(OrgContextError);
    });

    it('lists all user memberships annotated with active context', async () => {
      const orgs = await listUserOrganizations(userAlpha, 'org_beta', db);
      expect(orgs).toHaveLength(2);

      const alpha = orgs.find((o) => o.orgId === 'org_alpha');
      const beta = orgs.find((o) => o.orgId === 'org_beta');

      expect(alpha?.isOwner).toBe(true);
      expect(alpha?.isActiveContext).toBe(false);

      expect(beta?.role).toBe('creator');
      expect(beta?.isActiveContext).toBe(true);
    });
  });

  describe('Tenant Scope Assertion & Isolation Guard', () => {
    it('assertTenantScope allows matching contexts', () => {
      expect(() => assertTenantScope('org_alpha', 'org_alpha')).not.toThrow();
      expect(() => assertTenantScope('org_beta', 'org_beta')).not.toThrow();
    });

    it('assertTenantScope throws CROSS_TENANT_VIOLATION on mismatch or empty input', () => {
      expect(() => assertTenantScope('org_alpha', 'org_beta')).toThrow(
        /CROSS_TENANT_VIOLATION/,
      );
      expect(() => assertTenantScope('', 'org_alpha')).toThrow(
        /CROSS_TENANT_VIOLATION/,
      );
      expect(() => assertTenantScope('org_alpha', undefined)).toThrow(
        /CROSS_TENANT_VIOLATION/,
      );
    });

    it('assertResourceScope validates resource tenant alignment', () => {
      const validResource = { id: 'res_1', org_id: 'org_alpha', title: 'Video 1' };
      const invalidResource = { id: 'res_2', org_id: 'org_beta', title: 'Video 2' };

      expect(() => assertResourceScope('org_alpha', validResource)).not.toThrow();
      expect(() => assertResourceScope('org_alpha', invalidResource)).toThrow(
        CrossTenantViolationError,
      );
    });

    it('filterByTenant strictly prevents cross-tenant data leakage', () => {
      const items = [
        { id: '1', org_id: 'org_alpha', name: 'Alpha Item 1' },
        { id: '2', org_id: 'org_beta', name: 'Beta Item' },
        { id: '3', org_id: 'org_alpha', name: 'Alpha Item 2' },
      ];

      const filtered = filterByTenant(items, 'org_alpha');
      expect(filtered).toHaveLength(2);
      expect(filtered.map((i) => i.id)).toEqual(['1', '3']);
    });
  });
});

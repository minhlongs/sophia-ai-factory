/**
 * Direct Integration Test Suite: Agency Tenant Server Actions
 *
 * Exercises all 7 Server Actions against an authentic in-memory D1 test fixture
 * initialized with migration 0435_agy_multitenancy_and_tenant_isolation.sql:
 * - registerAgencyTenant
 * - getAgencyTenantConfig
 * - registerAgencyDomain
 * - issueAgencyTenantToken
 * - updateAgencyQuota
 * - incrementAgencyQuotaUsed
 * - revokeAgencyTenantToken
 * - queryAgencyAuditLogs
 *
 * Layer: land/agy/__tests__
 * Integrity: Direct integration against real SQLite D1 engine (zero facades/mocks).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeSqliteD1Database } from '@/seed/db/node-sqlite-d1';
import {
  registerAgencyTenant,
  registerAgencyDomain,
  issueAgencyTenantToken,
  updateAgencyQuota,
  incrementAgencyQuotaUsed,
  getAgencyTenantConfig,
  revokeAgencyTenantToken,
  queryAgencyAuditLogs,
} from '../agency-tenant-actions';
import { verifyTenantTokenSignature } from '@/tree/agy/tenant-token-engine';

describe('Agency Tenant Server Actions (D1 Integration)', () => {
  let db: NodeSqliteD1Database;
  const TEST_SECRET = 'sophia-agy-dev-secret-key-32b';

  beforeEach(() => {
    // 1. Initialize authentic in-memory SQLite D1 database
    db = new NodeSqliteD1Database(':memory:');

    // 2. Load and execute authentic 0435 migration
    const migrationPath = path.resolve(
      __dirname,
      '../../../../migrations/0435_agy_multitenancy_and_tenant_isolation.sql'
    );
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    db.exec(migrationSql);

    // 3. Bind to global CF/D1 contexts
    (globalThis as Record<string, unknown>).__env__ = { DB: db };
    (globalThis as Record<string, unknown>).__D1_DB = db;
    process.env.AGY_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__env__;
    delete (globalThis as Record<string, unknown>).__D1_DB;
  });

  describe('1. registerAgencyTenant', () => {
    it('successfully registers an agency tenant with default quotas', async () => {
      const res = await registerAgencyTenant({
        orgId: 'org_enterprise_1',
        agencySlug: 'growth-apex',
      });

      expect(res.success).toBe(true);
      expect(res.agencyId).toBeDefined();
      expect(res.agencyId).toMatch(/^agy_\d+_[a-z0-9]+$/);

      const config = await getAgencyTenantConfig(res.agencyId!);
      expect(config).not.toBeNull();
      expect(config?.orgId).toBe('org_enterprise_1');
      expect(config?.agencySlug).toBe('growth-apex');
      expect(config?.status).toBe('active');
      expect(config?.quotaLimitMcu).toBe(100000);
      expect(config?.quotaUsedMcu).toBe(0);
      expect(config?.rateLimitRps).toBe(100);
    });

    it('registers an agency tenant with custom quotas and custom domain', async () => {
      const res = await registerAgencyTenant({
        orgId: 'org_enterprise_2',
        agencySlug: 'media-group',
        customDomain: 'https://portal.mediagroup.io:443/',
        quotaLimitMcu: 250000,
        rateLimitRps: 200,
        actorId: 'usr_founder_1',
      });

      expect(res.success).toBe(true);
      const config = await getAgencyTenantConfig(res.agencyId!);
      expect(config?.customDomain).toBe('portal.mediagroup.io');
      expect(config?.quotaLimitMcu).toBe(250000);
      expect(config?.rateLimitRps).toBe(200);

      // Verify audit log
      const logs = await queryAgencyAuditLogs(res.agencyId!);
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].eventType).toBe('AGENCY_REGISTERED');
      expect(logs[0].actorId).toBe('usr_founder_1');
    });

    it('rejects registration when orgId is missing', async () => {
      const res = await registerAgencyTenant({
        orgId: '',
        agencySlug: 'invalid-agency',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe('orgId is required');
    });

    it('rejects registration with invalid or reserved agency slug', async () => {
      const resReserved = await registerAgencyTenant({
        orgId: 'org_test',
        agencySlug: 'sophia', // Reserved platform subdomain
      });
      expect(resReserved.success).toBe(false);
      expect(resReserved.error).toContain('Invalid or reserved agency slug');

      const resInvalid = await registerAgencyTenant({
        orgId: 'org_test',
        agencySlug: '-invalid-slug-',
      });
      expect(resInvalid.success).toBe(false);
      expect(resInvalid.error).toContain('Invalid or reserved agency slug');
    });
  });

  describe('2. getAgencyTenantConfig', () => {
    it('retrieves agency config by agencyId and by agencySlug interchangeably', async () => {
      const created = await registerAgencyTenant({
        orgId: 'org_lookup_test',
        agencySlug: 'lookup-agency',
      });
      const agencyId = created.agencyId!;

      const byId = await getAgencyTenantConfig(agencyId);
      const bySlug = await getAgencyTenantConfig('lookup-agency');

      expect(byId).not.toBeNull();
      expect(bySlug).not.toBeNull();
      expect(byId?.agencyId).toBe(agencyId);
      expect(bySlug?.agencyId).toBe(agencyId);
    });

    it('returns null when agency does not exist', async () => {
      const config = await getAgencyTenantConfig('non_existent_agency');
      expect(config).toBeNull();
    });
  });

  describe('3. registerAgencyDomain', () => {
    it('registers a custom domain and subdomain record in D1', async () => {
      const reg = await registerAgencyTenant({
        orgId: 'org_domain_test',
        agencySlug: 'domain-agency',
      });
      const agencyId = reg.agencyId!;

      const res = await registerAgencyDomain({
        agencyId,
        domain: 'agency.clientcorp.com',
        domainType: 'custom',
        isPrimary: true,
      });

      expect(res.success).toBe(true);
      expect(res.domainId).toBeDefined();

      const stmt = db.prepare('SELECT * FROM agy_agency_domains WHERE id = ?1');
      const row = await stmt.bind(res.domainId!).first<{ domain: string; is_primary: number; ssl_status: string }>();
      expect(row?.domain).toBe('agency.clientcorp.com');
      expect(row?.is_primary).toBe(1);
      expect(row?.ssl_status).toBe('pending');
    });

    it('rejects domain registration when agencyId or domain is missing', async () => {
      const res1 = await registerAgencyDomain({ agencyId: '', domain: 'example.com' });
      expect(res1.success).toBe(false);

      const res2 = await registerAgencyDomain({ agencyId: 'agy_123', domain: '' });
      expect(res2.success).toBe(false);
    });
  });

  describe('4. issueAgencyTenantToken', () => {
    it('issues a cryptographically verified tenant token and stores SHA-256 hash', async () => {
      const reg = await registerAgencyTenant({
        orgId: 'org_token_test',
        agencySlug: 'token-agency',
      });
      const agencyId = reg.agencyId!;

      const res = await issueAgencyTenantToken({
        agencyId,
        name: 'Production Worker Token',
        permissions: ['read', 'write', 'video:*'],
        expiresInSeconds: 3600,
      });

      expect(res.success).toBe(true);
      expect(res.token).toBeDefined();
      expect(res.token?.startsWith('agy_tok_')).toBe(true);
      expect(res.tokenHash).toHaveLength(64); // SHA-256 hex string

      // Verify cryptographic authenticity via tree engine
      const verification = await verifyTenantTokenSignature(res.token!, TEST_SECRET);
      expect(verification.valid).toBe(true);
      expect(verification.payload?.agencyId).toBe(agencyId);

      // Verify record stored in D1
      const row = await db
        .prepare('SELECT * FROM agy_tenant_tokens WHERE token_hash = ?1')
        .bind(res.tokenHash!)
        .first<{ name: string; permissions_json: string }>();
      expect(row?.name).toBe('Production Worker Token');
      expect(JSON.parse(row?.permissions_json || '[]')).toEqual(['read', 'write', 'video:*']);
    });

    it('rejects token issuance without agencyId or token name', async () => {
      const res = await issueAgencyTenantToken({ agencyId: '', name: 'Test' });
      expect(res.success).toBe(false);
    });
  });

  describe('5. updateAgencyQuota & incrementAgencyQuotaUsed', () => {
    it('updates agency quota limit and rate limit', async () => {
      const reg = await registerAgencyTenant({
        orgId: 'org_quota_test',
        agencySlug: 'quota-agency',
      });
      const agencyId = reg.agencyId!;

      const updateRes = await updateAgencyQuota({
        agencyId,
        quotaLimitMcu: 300000,
        rateLimitRps: 250,
      });
      expect(updateRes.success).toBe(true);

      const config = await getAgencyTenantConfig(agencyId);
      expect(config?.quotaLimitMcu).toBe(300000);
      expect(config?.rateLimitRps).toBe(250);
    });

    it('rejects negative quota limit values', async () => {
      const res = await updateAgencyQuota({
        agencyId: 'agy_123',
        quotaLimitMcu: -500,
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain('non-negative quotaLimitMcu');
    });

    it('increments agency quota used and accumulates usage accurately', async () => {
      const reg = await registerAgencyTenant({
        orgId: 'org_inc_test',
        agencySlug: 'inc-agency',
      });
      const agencyId = reg.agencyId!;

      const inc1 = await incrementAgencyQuotaUsed(agencyId, 1250);
      expect(inc1.success).toBe(true);
      expect(inc1.newQuotaUsedMcu).toBe(1250);

      const inc2 = await incrementAgencyQuotaUsed(agencyId, 750);
      expect(inc2.success).toBe(true);
      expect(inc2.newQuotaUsedMcu).toBe(2000);

      const config = await getAgencyTenantConfig(agencyId);
      expect(config?.quotaUsedMcu).toBe(2000);
    });

    it('clamps decrements (negative delta) so used quota never drops below zero', async () => {
      const reg = await registerAgencyTenant({
        orgId: 'org_clamp_test',
        agencySlug: 'clamp-agency',
      });
      const agencyId = reg.agencyId!;

      await incrementAgencyQuotaUsed(agencyId, 500);
      const decRes = await incrementAgencyQuotaUsed(agencyId, -1000);
      expect(decRes.success).toBe(true);
      expect(decRes.newQuotaUsedMcu).toBe(0);
    });
  });

  describe('6. revokeAgencyTenantToken', () => {
    it('revokes an active tenant token and stamps revoked_at', async () => {
      const reg = await registerAgencyTenant({
        orgId: 'org_revoke_test',
        agencySlug: 'revoke-agency',
      });
      const agencyId = reg.agencyId!;

      const tok = await issueAgencyTenantToken({
        agencyId,
        name: 'Ephemeral Token',
      });
      const tokenId = tok.tokenId!;

      const revokeRes = await revokeAgencyTenantToken(tokenId, agencyId);
      expect(revokeRes.success).toBe(true);

      const row = await db
        .prepare('SELECT revoked_at FROM agy_tenant_tokens WHERE id = ?1')
        .bind(tokenId)
        .first<{ revoked_at: number | null }>();
      expect(row?.revoked_at).not.toBeNull();
      expect(row?.revoked_at).toBeGreaterThan(0);
    });
  });

  describe('7. queryAgencyAuditLogs', () => {
    it('returns structured audit logs scoped strictly to the requested agency', async () => {
      const reg1 = await registerAgencyTenant({ orgId: 'org_aud_1', agencySlug: 'aud-agency-1' });
      const reg2 = await registerAgencyTenant({ orgId: 'org_aud_2', agencySlug: 'aud-agency-2' });

      await issueAgencyTenantToken({ agencyId: reg1.agencyId!, name: 'Token 1' });
      await issueAgencyTenantToken({ agencyId: reg2.agencyId!, name: 'Token 2' });

      const logs1 = await queryAgencyAuditLogs(reg1.agencyId!);
      const logs2 = await queryAgencyAuditLogs(reg2.agencyId!);

      expect(logs1.length).toBe(2); // AGENCY_REGISTERED + TOKEN_ISSUED
      expect(logs2.length).toBe(2);

      // Verify strict agency isolation
      expect(logs1.every((l) => l.agencyId === reg1.agencyId)).toBe(true);
      expect(logs2.every((l) => l.agencyId === reg2.agencyId)).toBe(true);

      // Verify detail deserialization
      expect(logs1[0].details).toBeDefined();
      expect(typeof logs1[0].details).toBe('object');
    });
  });

  describe('8. Comprehensive Lifecycle Integration Sequence', () => {
    it('executes a complete agency lifecycle end-to-end without errors', async () => {
      // Step 1: Register tenant
      const reg = await registerAgencyTenant({
        orgId: 'org_full_lifecycle',
        agencySlug: 'nexus-studios',
        customDomain: 'nexus.agencyos.network',
        quotaLimitMcu: 100000,
        rateLimitRps: 150,
      });
      expect(reg.success).toBe(true);
      const agencyId = reg.agencyId!;

      // Step 2: Bind custom domain
      const dom = await registerAgencyDomain({
        agencyId,
        domain: 'portal.nexusstudios.com',
        domainType: 'custom',
        isPrimary: true,
      });
      expect(dom.success).toBe(true);

      // Step 3: Issue token
      const tok = await issueAgencyTenantToken({
        agencyId,
        name: 'Agent Automation Key',
        permissions: ['read', 'write'],
      });
      expect(tok.success).toBe(true);

      // Step 4: Consume compute quota
      const inc = await incrementAgencyQuotaUsed(agencyId, 15000);
      expect(inc.success).toBe(true);

      // Step 5: Update quota limit
      const upd = await updateAgencyQuota({
        agencyId,
        quotaLimitMcu: 500000,
        rateLimitRps: 300,
      });
      expect(upd.success).toBe(true);

      // Step 6: Revoke token
      const rev = await revokeAgencyTenantToken(tok.tokenId!, agencyId);
      expect(rev.success).toBe(true);

      // Step 7: Inspect audit logs
      const logs = await queryAgencyAuditLogs(agencyId);
      expect(logs.length).toBe(5); // REGISTERED, DOMAIN, TOKEN_ISSUED, QUOTA_UPDATED, TOKEN_REVOKED
    });
  });
});

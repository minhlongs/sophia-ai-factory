/**
 * Tier 1 to 4: Comprehensive Opaque-Box E2E Test Suite for Full-Stack AGY
 * (AgencyOS Multi-Tenancy, Agent Governance YAML, Client Onboarding & Agency Portal)
 *
 * Implements the full requirement-driven test suite specified in PROJECT.md:
 * - Tier 1: Feature Coverage (>=5 tests per feature for R1, R2, R3 - 75 tests)
 * - Tier 2: Boundary & Corner Cases (25 tests covering slugs, compute, YAML, rate limits, security)
 * - Tier 3: Cross-Feature Pairwise Combinations (6 comprehensive cross-module pipelines)
 * - Tier 4: Real-World Agency Scenarios (5 complete agency lifecycle simulations)
 *
 * @module tests/e2e/agy-fullstack.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAgyTestD1,
  resolveTenantFromHostname,
  generateAgyTenantToken,
  verifyAgyTenantToken,
  AgencyRateLimitEngine,
  checkAndDeductComputeQuota,
  parseAgentGovernanceYaml,
  matchPermission,
  evaluateAgyPolicy,
  generatePolicyEvaluationDigest,
  logPolicyEvaluationToLedger,
  validateAgencySlug,
  sanitizeBrandCssColor,
  executeAgencyOnboarding,
  fetchAgencyPortalOverview,
  recordAgencySubaccountRevenue,
  type MockD1Database,
  type AgentGovernanceYaml,
  type PolicyEvaluationRequest,
  MAX_AGY_YAML_BYTES,
} from './agy-harness';

describe('Full-Stack AGY Comprehensive E2E Test Suite', () => {
  let db: MockD1Database;
  const SECRET_KEY = 'super-secret-enterprise-hmac-key-123456';

  beforeEach(() => {
    db = createAgyTestD1();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 1: FEATURE COVERAGE (R1, R2, R3) — 15 Features, >=5 tests each (75 tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 1: Feature Coverage', () => {
    // ─── Feature 1: Multi-Agency Domain Router (R1) ───────────────────────────
    describe('F1: Multi-Agency Domain Router', () => {
      it('1.1 resolves valid customer agency subdomain to tenant context', () => {
        const result = resolveTenantFromHostname('vanguard.agencyos.network');
        expect(result.isAgencySubdomain).toBe(true);
        expect(result.isCustomDomain).toBe(false);
        expect(result.agencySlug).toBe('vanguard');
        expect(result.tenantOrgId).toBe('org_vanguard');
        expect(result.agencyId).toBe('agy_vanguard');
      });

      it('1.2 resolves custom domains via registry lookup function', () => {
        const mockLookup = (domain: string) => {
          if (domain === 'agency.acmecorp.com') {
            return { agencyId: 'agy_acme', orgId: 'org_acme', agencySlug: 'acme' };
          }
          return null;
        };
        const result = resolveTenantFromHostname('agency.acmecorp.com', mockLookup);
        expect(result.isAgencySubdomain).toBe(false);
        expect(result.isCustomDomain).toBe(true);
        expect(result.agencySlug).toBe('acme');
        expect(result.agencyId).toBe('agy_acme');
        expect(result.tenantOrgId).toBe('org_acme');
      });

      it('1.3 treats apex domain as non-agency platform root', () => {
        const result = resolveTenantFromHostname('agencyos.network');
        expect(result.isAgencySubdomain).toBe(false);
        expect(result.isCustomDomain).toBe(false);
        expect(result.agencySlug).toBeNull();
        expect(result.agencyId).toBeNull();
      });

      it('1.4 returns null agency context for unmapped third-party domains', () => {
        const result = resolveTenantFromHostname('random-unmapped-domain.com');
        expect(result.isAgencySubdomain).toBe(false);
        expect(result.isCustomDomain).toBe(false);
        expect(result.agencySlug).toBeNull();
      });

      it('1.5 handles mixed case and surrounding whitespace in hostname', () => {
        const result = resolveTenantFromHostname('  NEXUS-MEDIA.agencyos.network  ');
        expect(result.isAgencySubdomain).toBe(true);
        expect(result.agencySlug).toBe('nexus-media');
        expect(result.agencyId).toBe('agy_nexus-media');
      });
    });

    // ─── Feature 2: Reserved Domain Partitioning (R1) ────────────────────────
    describe('F2: Reserved Domain Partitioning', () => {
      it('2.1 classifies "sophia" as reserved platform subdomain', () => {
        const result = resolveTenantFromHostname('sophia.agencyos.network');
        expect(result.isAgencySubdomain).toBe(false);
        expect(result.agencySlug).toBeNull();
      });

      it('2.2 classifies "admin" and "api" as reserved platform subdomains', () => {
        const adminRes = resolveTenantFromHostname('admin.agencyos.network');
        const apiRes = resolveTenantFromHostname('api.agencyos.network');
        expect(adminRes.isAgencySubdomain).toBe(false);
        expect(apiRes.isAgencySubdomain).toBe(false);
        expect(adminRes.agencySlug).toBeNull();
        expect(apiRes.agencySlug).toBeNull();
      });

      it('2.3 classifies "sub" and "portal" as reserved platform subdomains', () => {
        const subRes = resolveTenantFromHostname('sub.agencyos.network');
        const portalRes = resolveTenantFromHostname('portal.agencyos.network');
        expect(subRes.isAgencySubdomain).toBe(false);
        expect(portalRes.isAgencySubdomain).toBe(false);
      });

      it('2.4 classifies infrastructure subdomains (preview, cdn, workers, cname) as reserved', () => {
        for (const reserved of ['preview', 'cdn', 'workers', 'cname', 'pages', 'app', 'www']) {
          const res = resolveTenantFromHostname(`${reserved}.agencyos.network`);
          expect(res.isAgencySubdomain).toBe(false);
          expect(res.agencySlug).toBeNull();
        }
      });

      it('2.5 allows non-reserved compound slugs containing reserved keywords', () => {
        const res1 = resolveTenantFromHostname('portal-marketing.agencyos.network');
        const res2 = resolveTenantFromHostname('api-creators.agencyos.network');
        expect(res1.isAgencySubdomain).toBe(true);
        expect(res1.agencySlug).toBe('portal-marketing');
        expect(res2.isAgencySubdomain).toBe(true);
        expect(res2.agencySlug).toBe('api-creators');
      });
    });

    // ─── Feature 3: Tenant Token Generation & Cryptographic Verification (R1) ─
    describe('F3: Tenant Token Generation & Cryptographic Verification', () => {
      it('3.1 generates cryptographically signed HMAC-SHA256 token', () => {
        const token = generateAgyTenantToken(SECRET_KEY, 'agy_alpha', ['campaign:run', 'video:generate'], 3600);
        expect(token.agencyId).toBe('agy_alpha');
        expect(token.signature).toHaveLength(64);
        expect(token.expiresAt).toBeGreaterThan(Date.now());
        expect(token.token).toBeDefined();
      });

      it('3.2 verifies authentic tenant token successfully', () => {
        const token = generateAgyTenantToken(SECRET_KEY, 'agy_beta', ['campaign:read'], 1800);
        const verification = verifyAgyTenantToken(SECRET_KEY, token);
        expect(verification.valid).toBe(true);
        expect(verification.reason).toBeUndefined();
      });

      it('3.3 rejects expired tenant token with TOKEN_EXPIRED', () => {
        const pastTime = Date.now() - 5000;
        const expiredToken = generateAgyTenantToken(SECRET_KEY, 'agy_gamma', ['video:export'], -10, pastTime);
        const verification = verifyAgyTenantToken(SECRET_KEY, expiredToken, Date.now());
        expect(verification.valid).toBe(false);
        expect(verification.reason).toBe('TOKEN_EXPIRED');
      });

      it('3.4 detects single-bit signature tampering with INVALID_SIGNATURE', () => {
        const token = generateAgyTenantToken(SECRET_KEY, 'agy_delta', ['analytics:view'], 3600);
        const tamperedSig = token.signature.substring(0, 63) + (token.signature[63] === 'a' ? 'b' : 'a');
        const verification = verifyAgyTenantToken(SECRET_KEY, { ...token, signature: tamperedSig });
        expect(verification.valid).toBe(false);
        expect(verification.reason).toBe('INVALID_SIGNATURE');
      });

      it('3.5 rejects generation with empty agencyId or weak secret key', () => {
        expect(() => generateAgyTenantToken('weak-key', 'agy_test', ['read'])).toThrow('SECRET_KEY_TOO_WEAK');
        expect(() => generateAgyTenantToken(SECRET_KEY, '', ['read'])).toThrow('INVALID_AGENCY_ID');
      });
    });

    // ─── Feature 4: D1 Row-Level Tenant Isolation & Scoping (R1) ───────────────
    describe('F4: D1 Row-Level Tenant Isolation & Scoping', () => {
      it('4.1 persists tenant configs with strict agency_id scoping', async () => {
        await db
          .prepare(
            `INSERT INTO agy_tenant_configs (id, agency_id, org_id, agency_slug, quota_limit_mcu, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .bind('cfg_1', 'agy_tenant_a', 'org_a', 'tenant-a', 50000, Date.now(), Date.now())
          .run();

        const config = await db
          .prepare('SELECT * FROM agy_tenant_configs WHERE agency_id = ?')
          .bind('agy_tenant_a')
          .first<{ agency_slug: string }>();

        expect(config?.agency_slug).toBe('tenant-a');
      });

      it('4.2 prevents cross-tenant data leakage when filtering by agency_id', async () => {
        await db
          .prepare('INSERT INTO agy_tenant_configs (id, agency_id, org_id, agency_slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind('cfg_a', 'agy_a', 'org_a', 'agency-a', 100, 100)
          .run();
        await db
          .prepare('INSERT INTO agy_tenant_configs (id, agency_id, org_id, agency_slug, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind('cfg_b', 'agy_b', 'org_b', 'agency-b', 100, 100)
          .run();

        const aResults = await db
          .prepare('SELECT agency_id FROM agy_tenant_configs WHERE agency_id = ?')
          .bind('agy_a')
          .all<{ agency_id: string }>();

        expect(aResults.results).toHaveLength(1);
        expect(aResults.results[0].agency_id).toBe('agy_a');
      });

      it('4.3 maintains strict tenant isolation for subaccounts', async () => {
        await db
          .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, created_at) VALUES (?, ?, ?, ?)')
          .bind('sub_1', 'agy_1', 'Client Alpha', Date.now())
          .run();
        await db
          .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, created_at) VALUES (?, ?, ?, ?)')
          .bind('sub_2', 'agy_2', 'Client Beta', Date.now())
          .run();

        const agy1Subs = await db
          .prepare('SELECT * FROM agy_subaccounts WHERE agency_id = ?')
          .bind('agy_1')
          .all<{ client_name: string }>();

        expect(agy1Subs.results).toHaveLength(1);
        expect(agy1Subs.results[0].client_name).toBe('Client Alpha');
      });

      it('4.4 blocks cross-tenant update tampering with where agency_id guard', async () => {
        await db
          .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, mcu_allocated, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind('sub_target', 'agy_victim', 'Victim Client', 1000, Date.now())
          .run();

        // Attacker from agy_attacker tries to modify sub_target
        const updateRes = await db
          .prepare('UPDATE agy_subaccounts SET mcu_allocated = 99999 WHERE id = ? AND agency_id = ?')
          .bind('sub_target', 'agy_attacker')
          .run();

        expect(updateRes.meta.changes).toBe(0);

        const check = await db
          .prepare('SELECT mcu_allocated FROM agy_subaccounts WHERE id = ?')
          .bind('sub_target')
          .first<{ mcu_allocated: number }>();
        expect(check?.mcu_allocated).toBe(1000);
      });

      it('4.5 isolates audit logs per agency boundary', async () => {
        await db
          .prepare('INSERT INTO agy_audit_logs (id, agency_id, event_type, actor_id, payload_json, record_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind('log_1', 'agy_x', 'ONBOARD', 'usr_1', '{}', 'hash_1', Date.now())
          .run();
        await db
          .prepare('INSERT INTO agy_audit_logs (id, agency_id, event_type, actor_id, payload_json, record_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
          .bind('log_2', 'agy_y', 'DELETE', 'usr_2', '{}', 'hash_2', Date.now())
          .run();

        const xLogs = await db
          .prepare('SELECT id FROM agy_audit_logs WHERE agency_id = ?')
          .bind('agy_x')
          .all();
        expect(xLogs.results).toHaveLength(1);
        expect(xLogs.results[0].id).toBe('log_1');
      });
    });

    // ─── Feature 5: Sliding-Window Rate Limiting & Quotas (R1) ─────────────────
    describe('F5: Sliding-Window Rate Limiting & Quotas', () => {
      it('5.1 permits requests within RPS threshold', () => {
        const rateLimiter = new AgencyRateLimitEngine();
        const now = 1000000;
        for (let i = 0; i < 5; i++) {
          const res = rateLimiter.checkRateLimit('agy_test', 10, now + i * 10);
          expect(res.allowed).toBe(true);
        }
      });

      it('5.2 rejects requests exceeding RPS limit (HTTP 429)', () => {
        const rateLimiter = new AgencyRateLimitEngine();
        const now = 1000000;
        for (let i = 0; i < 5; i++) {
          rateLimiter.checkRateLimit('agy_burst', 5, now);
        }
        const burst6 = rateLimiter.checkRateLimit('agy_burst', 5, now);
        expect(burst6.allowed).toBe(false);
        expect(burst6.remaining).toBe(0);
        expect(burst6.retryAfterMs).toBeGreaterThan(0);
      });

      it('5.3 accurately calculates retryAfterMs for burst recovery', () => {
        const rateLimiter = new AgencyRateLimitEngine();
        const now = 1000000;
        rateLimiter.checkRateLimit('agy_calc', 2, now);
        rateLimiter.checkRateLimit('agy_calc', 2, now + 100);
        const overLimit = rateLimiter.checkRateLimit('agy_calc', 2, now + 200);
        expect(overLimit.allowed).toBe(false);
        expect(overLimit.retryAfterMs).toBe(800); // 1000ms - 200ms elapsed = 800ms
      });

      it('5.4 slides window and restores quota after 1000ms elapse', () => {
        const rateLimiter = new AgencyRateLimitEngine();
        const now = 1000000;
        rateLimiter.checkRateLimit('agy_slide', 1, now);
        expect(rateLimiter.checkRateLimit('agy_slide', 1, now).allowed).toBe(false);
        expect(rateLimiter.checkRateLimit('agy_slide', 1, now + 1001).allowed).toBe(true);
      });

      it('5.5 deducts compute quota in MCU and stops when exhausted (HTTP 402)', async () => {
        await db
          .prepare(
            `INSERT INTO agy_tenant_configs (id, agency_id, org_id, agency_slug, quota_limit_mcu, quota_used_mcu, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind('cfg_quota', 'agy_compute_test', 'org_1', 'comp-test', 100, 80, Date.now(), Date.now())
          .run();

        // 10 MCU deduction is within 20 remaining
        const res1 = await checkAndDeductComputeQuota(db, 'agy_compute_test', 10);
        expect(res1.allowed).toBe(true);
        expect(res1.quotaUsedMcu).toBe(90);
        expect(res1.remainingMcu).toBe(10);

        // 15 MCU deduction exceeds 10 remaining -> QUOTA_EXHAUSTED
        const res2 = await checkAndDeductComputeQuota(db, 'agy_compute_test', 15);
        expect(res2.allowed).toBe(false);
        expect(res2.reason).toBe('QUOTA_EXHAUSTED');
      });
    });

    // ─── Feature 6: Declarative AGY YAML Schema & Parser (R2) ──────────────────
    describe('F6: Declarative AGY YAML Schema & Parser', () => {
      const sampleYaml = `
schemaVersion: "1.0"
agent:
  id: "agent_video_gen"
  name: "Autonomous Video Creator"
  role: "video_creator"
  maxAutonomyLevel: "L2"
compute:
  maxTokensPerRun: 8192
  maxComputeUnitsMcu: 50
permissions:
  allow:
    - "video:generate"
    - "video:export"
    - "render:*"
  deny:
    - "billing:*"
    - "system:reconfigure"
escalation:
  onQuotaExceeded: "halt"
  onDisallowedAction: "escalate_human"
`;

      it('6.1 parses valid AGY document into strongly-typed object', () => {
        const parsed = parseAgentGovernanceYaml(sampleYaml);
        expect(parsed.schemaVersion).toBe('1.0');
        expect(parsed.agent.id).toBe('agent_video_gen');
        expect(parsed.agent.maxAutonomyLevel).toBe('L2');
        expect(parsed.compute.maxComputeUnitsMcu).toBe(50);
        expect(parsed.permissions.allow).toContain('video:generate');
        expect(parsed.permissions.deny).toContain('billing:*');
        expect(parsed.escalation.onDisallowedAction).toBe('escalate_human');
      });

      it('6.2 rejects oversized YAML payload exceeding 512KB cap', () => {
        const giantComment = '# ' + 'x'.repeat(MAX_AGY_YAML_BYTES + 100);
        const oversizedYaml = sampleYaml + '\n' + giantComment;
        expect(() => parseAgentGovernanceYaml(oversizedYaml)).toThrow('PAYLOAD_TOO_LARGE');
      });

      it('6.3 rejects invalid schema when agent or compute sections are missing', () => {
        const incompleteYaml = 'schemaVersion: "1.0"\nagent:\n  id: "test"';
        expect(() => parseAgentGovernanceYaml(incompleteYaml)).toThrow('INVALID_SCHEMA');
      });

      it('6.4 enforces positive numbers for maxTokensPerRun and maxComputeUnitsMcu', () => {
        const invalidCompute = sampleYaml.replace('maxComputeUnitsMcu: 50', 'maxComputeUnitsMcu: -10');
        expect(() => parseAgentGovernanceYaml(invalidCompute)).toThrow('INVALID_SCHEMA: compute.maxComputeUnitsMcu must be a positive integer');
      });

      it('6.5 throws clean syntax error on malformed YAML document', () => {
        const malformed = `
schemaVersion: "1.0"
agent:
  id: [broken syntax
`;
        expect(() => parseAgentGovernanceYaml(malformed)).toThrow('YAML_SYNTAX_ERROR');
      });
    });

    // ─── Feature 7: AGY Autonomy Level Gatekeeper (R2) ─────────────────────────
    describe('F7: AGY Autonomy Level Gatekeeper', () => {
      let basePolicy: AgentGovernanceYaml;

      beforeEach(() => {
        basePolicy = {
          schemaVersion: '1.0',
          agent: { id: 'agent_test', name: 'Tester', role: 'tester', maxAutonomyLevel: 'L2' },
          compute: { maxTokensPerRun: 4000, maxComputeUnitsMcu: 100 },
          permissions: { allow: ['*'], deny: [] },
          escalation: { onQuotaExceeded: 'halt', onDisallowedAction: 'halt' },
        };
      });

      it('7.1 permits action when requested autonomy <= maxAutonomyLevel', () => {
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_test',
          action: 'script:draft',
          requestedAutonomy: 'L2',
          requestedComputeUnits: 10,
        };
        const verdict = evaluateAgyPolicy(basePolicy, req, 'L1');
        expect(verdict.allowed).toBe(true);
        expect(verdict.reason).toBe('POLICY_APPROVED');
      });

      it('7.2 rejects action when requested autonomy > maxAutonomyLevel', () => {
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_test',
          action: 'campaign:publish_live',
          requestedAutonomy: 'L3', // Exceeds L2
          requestedComputeUnits: 10,
        };
        const verdict = evaluateAgyPolicy(basePolicy, req, 'L1');
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toBe('AUTONOMY_LEVEL_EXCEEDED');
        expect(verdict.escalationTriggered).toBe(true);
      });

      it('7.3 strictly enforces L0 to L4 hierarchy (L0 < L1 < L2 < L3 < L4)', () => {
        const l0Policy = { ...basePolicy, agent: { ...basePolicy.agent, maxAutonomyLevel: 'L0' as const } };
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_test',
          action: 'read:status',
          requestedAutonomy: 'L1',
          requestedComputeUnits: 5,
        };
        const verdict = evaluateAgyPolicy(l0Policy, req, 'L1');
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toBe('AUTONOMY_LEVEL_EXCEEDED');
      });

      it('7.4 triggers escalation when required autonomy of action exceeds agent cap', () => {
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_test',
          action: 'payment:execute',
          requestedAutonomy: 'L2',
          requestedComputeUnits: 10,
        };
        // Action requires L4
        const verdict = evaluateAgyPolicy(basePolicy, req, 'L4');
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toBe('AUTONOMY_LEVEL_EXCEEDED');
        expect(verdict.escalationTriggered).toBe(true);
      });

      it('7.5 approves autonomous execution when agent is at maximum L4 capability', () => {
        const l4Policy = { ...basePolicy, agent: { ...basePolicy.agent, maxAutonomyLevel: 'L4' as const } };
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_test',
          action: 'autonomous:rebalance',
          requestedAutonomy: 'L4',
          requestedComputeUnits: 10,
        };
        const verdict = evaluateAgyPolicy(l4Policy, req, 'L4');
        expect(verdict.allowed).toBe(true);
      });
    });

    // ─── Feature 8: Permission Matching & Deny-Precedence Engine (R2) ──────────
    describe('F8: Permission Matching & Deny-Precedence Engine', () => {
      const policy: AgentGovernanceYaml = {
        schemaVersion: '1.0',
        agent: { id: 'agent_perm', name: 'Perm Agent', role: 'bot', maxAutonomyLevel: 'L3' },
        compute: { maxTokensPerRun: 4000, maxComputeUnitsMcu: 100 },
        permissions: {
          allow: ['video:*', 'ugc:create', 'report:generate'],
          deny: ['video:delete', 'billing:*'],
        },
        escalation: { onQuotaExceeded: 'halt', onDisallowedAction: 'escalate_human' },
      };

      it('8.1 matches exact allowed permission', () => {
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_perm',
          action: 'ugc:create',
          requestedAutonomy: 'L1',
          requestedComputeUnits: 10,
        };
        expect(evaluateAgyPolicy(policy, req).allowed).toBe(true);
      });

      it('8.2 matches wildcard allow pattern (video:*)', () => {
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_perm',
          action: 'video:render_scene',
          requestedAutonomy: 'L1',
          requestedComputeUnits: 10,
        };
        expect(evaluateAgyPolicy(policy, req).allowed).toBe(true);
      });

      it('8.3 enforces DENY precedence over ALLOW (video:delete is in video:* but denied)', () => {
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_perm',
          action: 'video:delete',
          requestedAutonomy: 'L1',
          requestedComputeUnits: 10,
        };
        const verdict = evaluateAgyPolicy(policy, req);
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toBe('ACTION_EXPLICITLY_DENIED');
        expect(verdict.escalationTriggered).toBe(true);
      });

      it('8.4 denies any unlisted action with ACTION_NOT_PERMITTED', () => {
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_perm',
          action: 'unauthorized:operation',
          requestedAutonomy: 'L1',
          requestedComputeUnits: 10,
        };
        const verdict = evaluateAgyPolicy(policy, req);
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toBe('ACTION_NOT_PERMITTED');
      });

      it('8.5 supports global wildcard allow (*) while strictly preserving deny rules', () => {
        const wildcardPolicy: AgentGovernanceYaml = {
          ...policy,
          permissions: { allow: ['*'], deny: ['secret:*'] },
        };
        const okReq: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_perm',
          action: 'any:random:action',
          requestedAutonomy: 'L1',
          requestedComputeUnits: 10,
        };
        const deniedReq: PolicyEvaluationRequest = {
          ...okReq,
          action: 'secret:reveal',
        };
        expect(evaluateAgyPolicy(wildcardPolicy, okReq).allowed).toBe(true);
        expect(evaluateAgyPolicy(wildcardPolicy, deniedReq).allowed).toBe(false);
        expect(evaluateAgyPolicy(wildcardPolicy, deniedReq).reason).toBe('ACTION_EXPLICITLY_DENIED');
      });
    });

    // ─── Feature 9: Compute Limit & Token Cap Enforcement (R2) ─────────────────
    describe('F9: Compute Limit & Token Cap Enforcement', () => {
      const policy: AgentGovernanceYaml = {
        schemaVersion: '1.0',
        agent: { id: 'agent_comp', name: 'Compute Agent', role: 'bot', maxAutonomyLevel: 'L3' },
        compute: { maxTokensPerRun: 4096, maxComputeUnitsMcu: 25 },
        permissions: { allow: ['*'], deny: [] },
        escalation: { onQuotaExceeded: 'request_approval', onDisallowedAction: 'halt' },
      };

      it('9.1 allows execution within compute caps (<=25 MCU)', () => {
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_comp',
          action: 'video:transcode',
          requestedAutonomy: 'L1',
          requestedComputeUnits: 25,
        };
        const verdict = evaluateAgyPolicy(policy, req);
        expect(verdict.allowed).toBe(true);
        expect(verdict.reason).toBe('POLICY_APPROVED');
      });

      it('9.2 rejects execution exceeding single-run MCU cap (>25 MCU)', () => {
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_comp',
          action: 'video:transcode',
          requestedAutonomy: 'L1',
          requestedComputeUnits: 30, // Exceeds 25 MCU cap
        };
        const verdict = evaluateAgyPolicy(policy, req);
        expect(verdict.allowed).toBe(false);
        expect(verdict.reason).toBe('COMPUTE_LIMIT_EXCEEDED');
        expect(verdict.escalationTriggered).toBe(true); // onQuotaExceeded = request_approval
      });

      it('9.3 sets escalationTriggered=false when onQuotaExceeded is halt', () => {
        const haltPolicy: AgentGovernanceYaml = {
          ...policy,
          escalation: { onQuotaExceeded: 'halt', onDisallowedAction: 'halt' },
        };
        const req: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_comp',
          action: 'video:transcode',
          requestedAutonomy: 'L1',
          requestedComputeUnits: 30,
        };
        const verdict = evaluateAgyPolicy(haltPolicy, req);
        expect(verdict.allowed).toBe(false);
        expect(verdict.escalationTriggered).toBe(false);
      });

      it('9.4 rejects zero or negative requested compute units with COMPUTE_LIMIT_EXCEEDED', () => {
        const reqZero: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_comp',
          action: 'test',
          requestedAutonomy: 'L1',
          requestedComputeUnits: 0,
        };
        const reqNeg: PolicyEvaluationRequest = {
          ...reqZero,
          requestedComputeUnits: -15,
        };
        expect(evaluateAgyPolicy(policy, reqZero).allowed).toBe(false);
        expect(evaluateAgyPolicy(policy, reqNeg).allowed).toBe(false);
      });

      it('9.5 rejects NaN or infinite requested compute units', () => {
        const reqNaN: PolicyEvaluationRequest = {
          agencyId: 'agy_1',
          agentId: 'agent_comp',
          action: 'test',
          requestedAutonomy: 'L1',
          requestedComputeUnits: Number.NaN,
        };
        const reqInf: PolicyEvaluationRequest = {
          ...reqNaN,
          requestedComputeUnits: Number.POSITIVE_INFINITY,
        };
        expect(evaluateAgyPolicy(policy, reqNaN).allowed).toBe(false);
        expect(evaluateAgyPolicy(policy, reqInf).allowed).toBe(false);
      });
    });

    // ─── Feature 10: Deterministic SHA-256 Policy Evaluation Digest & Ledger (R2)
    describe('F10: Deterministic SHA-256 Policy Evaluation Digest & Ledger', () => {
      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_ledger',
        agentId: 'agent_007',
        action: 'video:generate',
        requestedAutonomy: 'L2',
        requestedComputeUnits: 10,
      };

      it('10.1 generates deterministic 64-character hex SHA-256 digest', () => {
        const digest1 = generatePolicyEvaluationDigest(req, true, 'POLICY_APPROVED');
        const digest2 = generatePolicyEvaluationDigest(req, true, 'POLICY_APPROVED');
        expect(digest1).toHaveLength(64);
        expect(digest1).toBe(digest2);
      });

      it('10.2 changes digest when evaluation outcome or parameter varies', () => {
        const digestApproved = generatePolicyEvaluationDigest(req, true, 'POLICY_APPROVED');
        const digestDenied = generatePolicyEvaluationDigest(req, false, 'DENIED');
        const digestDiffMcu = generatePolicyEvaluationDigest({ ...req, requestedComputeUnits: 20 }, true, 'POLICY_APPROVED');
        expect(digestApproved).not.toBe(digestDenied);
        expect(digestApproved).not.toBe(digestDiffMcu);
      });

      it('10.3 records evaluation decision in agy_policy_audit_ledger table', async () => {
        const verdict = {
          allowed: true,
          reason: 'POLICY_APPROVED',
          requiredAutonomy: 'L1' as const,
          escalationTriggered: false,
          evaluationSha256: generatePolicyEvaluationDigest(req, true, 'POLICY_APPROVED'),
        };
        const id = await logPolicyEvaluationToLedger(db, req, verdict);
        expect(id).toMatch(/^audit_/);

        const row = await db
          .prepare('SELECT * FROM agy_policy_audit_ledger WHERE id = ?')
          .bind(id)
          .first<{ agency_id: string; allowed: number; evaluation_sha256: string }>();

        expect(row?.agency_id).toBe('agy_ledger');
        expect(row?.allowed).toBe(1);
        expect(row?.evaluation_sha256).toBe(verdict.evaluationSha256);
      });

      it('10.4 preserves escalationTriggered flag accurately in audit record', async () => {
        const verdict = {
          allowed: false,
          reason: 'ACTION_EXPLICITLY_DENIED',
          requiredAutonomy: 'L3' as const,
          escalationTriggered: true,
          evaluationSha256: generatePolicyEvaluationDigest(req, false, 'ACTION_EXPLICITLY_DENIED'),
        };
        const id = await logPolicyEvaluationToLedger(db, req, verdict);
        const row = await db
          .prepare('SELECT escalation_triggered, allowed FROM agy_policy_audit_ledger WHERE id = ?')
          .bind(id)
          .first<{ escalation_triggered: number; allowed: number }>();

        expect(row?.escalation_triggered).toBe(1);
        expect(row?.allowed).toBe(0);
      });

      it('10.5 verifies audit ledger integrity by re-computing sha256 from row data', async () => {
        const verdict = {
          allowed: true,
          reason: 'POLICY_APPROVED',
          requiredAutonomy: 'L2' as const,
          escalationTriggered: false,
          evaluationSha256: generatePolicyEvaluationDigest(req, true, 'POLICY_APPROVED'),
        };
        const id = await logPolicyEvaluationToLedger(db, req, verdict);

        const row = await db
          .prepare('SELECT * FROM agy_policy_audit_ledger WHERE id = ?')
          .bind(id)
          .first<{
            agency_id: string;
            agent_id: string;
            action: string;
            requested_autonomy: string;
            requested_compute_units: number;
            allowed: number;
            reason: string;
            evaluation_sha256: string;
          }>();

        expect(row).toBeDefined();
        const expectedSha = generatePolicyEvaluationDigest(
          {
            agencyId: row!.agency_id,
            agentId: row!.agent_id,
            action: row!.action,
            requestedAutonomy: row!.requested_autonomy as any,
            requestedComputeUnits: row!.requested_compute_units,
          },
          row!.allowed === 1,
          row!.reason
        );
        expect(row!.evaluation_sha256).toBe(expectedSha);
      });
    });

    // ─── Feature 11: Agency Client Onboarding 5-Step Wizard Workflow (R3) ──────
    describe('F11: Agency Client Onboarding 5-Step Wizard Workflow', () => {
      it('11.1 validates standard agency slug format', () => {
        expect(validateAgencySlug('apex-media').valid).toBe(true);
        expect(validateAgencySlug('agency123').valid).toBe(true);
        expect(validateAgencySlug('vietnam-studio').valid).toBe(true);
      });

      it('11.2 rejects reserved platform keywords as agency slugs', () => {
        for (const reserved of ['sophia', 'admin', 'api', 'preview', 'portal', 'cdn', 'app']) {
          const res = validateAgencySlug(reserved);
          expect(res.valid).toBe(false);
          expect(res.error).toBe('SLUG_RESERVED: Cannot use reserved platform subdomain');
        }
      });

      it('11.3 rejects slugs with invalid length (<3 or >63 characters)', () => {
        expect(validateAgencySlug('ab').valid).toBe(false);
        expect(validateAgencySlug('a'.repeat(64)).valid).toBe(false);
      });

      it('11.4 rejects slugs containing uppercase or illegal symbols', () => {
        expect(validateAgencySlug('Agency_Name').valid).toBe(false);
        expect(validateAgencySlug('agency.dot').valid).toBe(false);
        expect(validateAgencySlug('agency@domain').valid).toBe(false);
      });

      it('11.5 executes full agency onboarding and creates tenant, domain, and seed agents', async () => {
        const onboardingInput = {
          agencyName: 'Velocity Digital',
          agencySlug: 'velocity-digital',
          customDomain: 'app.velocitydigital.io',
          primaryColor: '#6366F1',
          seedAgents: [
            { role: 'video_creator', template: 'tiktok_reels_pro', maxAutonomy: 'L2' as const },
            { role: 'ugc_reviewer', template: 'compliance_quality', maxAutonomy: 'L1' as const },
          ],
        };
        const result = await executeAgencyOnboarding(db, onboardingInput);
        expect(result.success).toBe(true);
        expect(result.agencyId).toBe('agy_velocity-digital');
        expect(result.slug).toBe('velocity-digital');

        // Check created tenant config
        const config = await db
          .prepare('SELECT * FROM agy_tenant_configs WHERE agency_id = ?')
          .bind(result.agencyId)
          .first<{ primary_color: string; custom_domain: string }>();
        expect(config?.primary_color).toBe('#6366F1');
        expect(config?.custom_domain).toBe('app.velocitydigital.io');

        // Check registered domains
        const domains = await db
          .prepare('SELECT domain_name, domain_type FROM agy_agency_domains WHERE agency_id = ?')
          .bind(result.agencyId)
          .all<{ domain_name: string; domain_type: string }>();
        expect(domains.results).toHaveLength(2);
      });
    });

    // ─── Feature 12: White-Label Branding Engine (R3) ──────────────────────────
    describe('F12: White-Label Branding Engine', () => {
      it('12.1 accepts valid #RGB, #RRGGBB, and #RRGGBBAA hex color codes', () => {
        expect(sanitizeBrandCssColor('#fff').valid).toBe(true);
        expect(sanitizeBrandCssColor('#10B981').valid).toBe(true);
        expect(sanitizeBrandCssColor('#10B981FF').valid).toBe(true);
      });

      it('12.2 accepts valid rgb() and rgba() CSS functional color notations', () => {
        expect(sanitizeBrandCssColor('rgb(59, 130, 246)').valid).toBe(true);
        expect(sanitizeBrandCssColor('rgba(59, 130, 246, 0.85)').valid).toBe(true);
      });

      it('12.3 strips and rejects malicious CSS injections (XSS payloads)', () => {
        const malicious = [
          'red; background: url(javascript:alert(1))',
          'expression(alert(1))',
          '<script>alert(1)</script>',
          '#123; border: 1px solid red;',
        ];
        for (const input of malicious) {
          expect(sanitizeBrandCssColor(input).valid).toBe(false);
        }
      });

      it('12.4 persists verified primaryColor to tenant settings in D1', async () => {
        await executeAgencyOnboarding(db, {
          agencyName: 'Brand Agency',
          agencySlug: 'brand-agency',
          primaryColor: '#0EA5E9',
          seedAgents: [],
        });
        const config = await db
          .prepare('SELECT primary_color FROM agy_tenant_configs WHERE agency_slug = ?')
          .bind('brand-agency')
          .first<{ primary_color: string }>();
        expect(config?.primary_color).toBe('#0EA5E9');
      });

      it('12.5 falls back to default theme #3B82F6 when color is omitted or invalid', async () => {
        await executeAgencyOnboarding(db, {
          agencyName: 'Fallback Agency',
          agencySlug: 'fallback-agency',
          primaryColor: 'invalid-css-color',
          seedAgents: [],
        });
        const config = await db
          .prepare('SELECT primary_color FROM agy_tenant_configs WHERE agency_slug = ?')
          .bind('fallback-agency')
          .first<{ primary_color: string }>();
        expect(config?.primary_color).toBe('#3B82F6');
      });
    });

    // ─── Feature 13: Seed Agent Deployment Flow (R3) ───────────────────────────
    describe('F13: Seed Agent Deployment Flow', () => {
      beforeEach(async () => {
        await executeAgencyOnboarding(db, {
          agencyName: 'Autonomous Fleet Agency',
          agencySlug: 'fleet-agency',
          seedAgents: [
            { role: 'video_creator', template: 'viral_hook_v1', maxAutonomy: 'L2' },
            { role: 'ugc_reviewer', template: 'audio_sync_v2', maxAutonomy: 'L1' },
            { role: 'outreach_bot', template: 'omnichannel_v1', maxAutonomy: 'L3' },
          ],
        });
      });

      it('13.1 provisions Video Creator agent with correct role and template', async () => {
        const agent = await db
          .prepare('SELECT * FROM agy_seed_agents WHERE agency_id = ? AND role = ?')
          .bind('agy_fleet-agency', 'video_creator')
          .first<{ template: string; max_autonomy: string }>();
        expect(agent?.template).toBe('viral_hook_v1');
        expect(agent?.max_autonomy).toBe('L2');
      });

      it('13.2 provisions UGC Reviewer agent with strict L1 autonomy bound', async () => {
        const agent = await db
          .prepare('SELECT * FROM agy_seed_agents WHERE agency_id = ? AND role = ?')
          .bind('agy_fleet-agency', 'ugc_reviewer')
          .first<{ max_autonomy: string }>();
        expect(agent?.max_autonomy).toBe('L1');
      });

      it('13.3 provisions Outreach Bot agent with L3 autonomy bound', async () => {
        const agent = await db
          .prepare('SELECT * FROM agy_seed_agents WHERE agency_id = ? AND role = ?')
          .bind('agy_fleet-agency', 'outreach_bot')
          .first<{ max_autonomy: string }>();
        expect(agent?.max_autonomy).toBe('L3');
      });

      it('13.4 attaches active status to all deployed seed agents', async () => {
        const agents = await db
          .prepare('SELECT status FROM agy_seed_agents WHERE agency_id = ?')
          .bind('agy_fleet-agency')
          .all<{ status: string }>();
        expect(agents.results).toHaveLength(3);
        expect(agents.results.every((a) => a.status === 'active')).toBe(true);
      });

      it('13.5 lists all deployed seed agents by agency without cross-tenant bleed', async () => {
        // Deploy for another agency
        await executeAgencyOnboarding(db, {
          agencyName: 'Other Agency',
          agencySlug: 'other-agency',
          seedAgents: [{ role: 'solo_agent', template: 't1', maxAutonomy: 'L0' }],
        });

        const fleetAgents = await db
          .prepare('SELECT * FROM agy_seed_agents WHERE agency_id = ?')
          .bind('agy_fleet-agency')
          .all();
        expect(fleetAgents.results).toHaveLength(3);
      });
    });

    // ─── Feature 14: High-Performance Agency Portal & KPI Metrics (R3) ─────────
    describe('F14: High-Performance Agency Portal & KPI Metrics', () => {
      beforeEach(async () => {
        await executeAgencyOnboarding(db, {
          agencyName: 'Skyline Media',
          agencySlug: 'skyline-media',
          seedAgents: [
            { role: 'agent_1', template: 't1', maxAutonomy: 'L1' },
            { role: 'agent_2', template: 't2', maxAutonomy: 'L2' },
          ],
        });
        // Create 3 subaccounts
        await db
          .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, created_at) VALUES (?, ?, ?, ?)')
          .bind('sub_1', 'agy_skyline-media', 'Client A', Date.now())
          .run();
        await db
          .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, created_at) VALUES (?, ?, ?, ?)')
          .bind('sub_2', 'agy_skyline-media', 'Client B', Date.now())
          .run();
        await db
          .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, created_at) VALUES (?, ?, ?, ?)')
          .bind('sub_3', 'agy_skyline-media', 'Client C', Date.now())
          .run();
      });

      it('14.1 aggregates total active clients count accurately', async () => {
        const overview = await fetchAgencyPortalOverview(db, 'agy_skyline-media');
        expect(overview.totalClients).toBe(3);
      });

      it('14.2 aggregates active campaigns / seed agents count', async () => {
        const overview = await fetchAgencyPortalOverview(db, 'agy_skyline-media');
        expect(overview.activeCampaigns).toBe(2);
      });

      it('14.3 aggregates cumulative MCU consumed across agency operations', async () => {
        await checkAndDeductComputeQuota(db, 'agy_skyline-media', 450);
        const overview = await fetchAgencyPortalOverview(db, 'agy_skyline-media');
        expect(overview.totalMcuConsumed).toBe(450);
      });

      it('14.4 calculates estimated MRR from attribution revenue ledger', async () => {
        await recordAgencySubaccountRevenue(db, 'agy_skyline-media', 'sub_1', 19900, 50); // $199.00
        await recordAgencySubaccountRevenue(db, 'agy_skyline-media', 'sub_2', 39900, 100); // $399.00
        const overview = await fetchAgencyPortalOverview(db, 'agy_skyline-media');
        expect(overview.estimatedMrrUsd).toBe(598); // $199 + $399 = $598
      });

      it('14.5 renders clean zero metrics for freshly provisioned agency', async () => {
        await executeAgencyOnboarding(db, {
          agencyName: 'Fresh Agency',
          agencySlug: 'fresh-agency',
          seedAgents: [],
        });
        const overview = await fetchAgencyPortalOverview(db, 'agy_fresh-agency');
        expect(overview.totalClients).toBe(0);
        expect(overview.activeCampaigns).toBe(0);
        expect(overview.totalMcuConsumed).toBe(0);
        expect(overview.estimatedMrrUsd).toBe(0);
      });
    });

    // ─── Feature 15: Agency Revenue Attribution Ledger (R3) ───────────────────
    describe('F15: Agency Revenue Attribution Ledger', () => {
      beforeEach(async () => {
        await executeAgencyOnboarding(db, {
          agencyName: 'Attribution Agency',
          agencySlug: 'attr-agency',
          seedAgents: [],
        });
        await db
          .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, mcu_allocated, mcu_used, created_at) VALUES (?, ?, ?, ?, ?, ?)')
          .bind('sub_attr_1', 'agy_attr-agency', 'Sub Client 1', 1000, 0, Date.now())
          .run();
      });

      it('15.1 logs attribution revenue event with amount_cents and mcu_consumed', async () => {
        const id = await recordAgencySubaccountRevenue(db, 'agy_attr-agency', 'sub_attr_1', 2500, 10, 'video_render');
        expect(id).toMatch(/^attr_/);

        const record = await db
          .prepare('SELECT * FROM agy_attribution_ledger WHERE id = ?')
          .bind(id)
          .first<{ amount_cents: number; mcu_consumed: number; attribution_type: string }>();

        expect(record?.amount_cents).toBe(2500);
        expect(record?.mcu_consumed).toBe(10);
        expect(record?.attribution_type).toBe('video_render');
      });

      it('15.2 updates subaccount mcu_used counter upon attribution recording', async () => {
        await recordAgencySubaccountRevenue(db, 'agy_attr-agency', 'sub_attr_1', 5000, 45);
        const sub = await db
          .prepare('SELECT mcu_used FROM agy_subaccounts WHERE id = ?')
          .bind('sub_attr_1')
          .first<{ mcu_used: number }>();
        expect(sub?.mcu_used).toBe(45);
      });

      it('15.3 increments parent agency quota_used_mcu counter in tandem', async () => {
        await recordAgencySubaccountRevenue(db, 'agy_attr-agency', 'sub_attr_1', 5000, 45);
        const cfg = await db
          .prepare('SELECT quota_used_mcu FROM agy_tenant_configs WHERE agency_id = ?')
          .bind('agy_attr-agency')
          .first<{ quota_used_mcu: number }>();
        expect(cfg?.quota_used_mcu).toBe(45);
      });

      it('15.4 accurately attributes revenue across multiple concurrent subaccounts', async () => {
        await db
          .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, created_at) VALUES (?, ?, ?, ?)')
          .bind('sub_attr_2', 'agy_attr-agency', 'Sub Client 2', Date.now())
          .run();

        await recordAgencySubaccountRevenue(db, 'agy_attr-agency', 'sub_attr_1', 10000, 20);
        await recordAgencySubaccountRevenue(db, 'agy_attr-agency', 'sub_attr_2', 15000, 30);

        const sub1 = await db.prepare('SELECT mcu_used FROM agy_subaccounts WHERE id = ?').bind('sub_attr_1').first<{ mcu_used: number }>();
        const sub2 = await db.prepare('SELECT mcu_used FROM agy_subaccounts WHERE id = ?').bind('sub_attr_2').first<{ mcu_used: number }>();
        expect(sub1?.mcu_used).toBe(20);
        expect(sub2?.mcu_used).toBe(30);
      });

      it('15.5 preserves immutable ledger entries without destructive update', async () => {
        const id1 = await recordAgencySubaccountRevenue(db, 'agy_attr-agency', 'sub_attr_1', 1000, 5);
        const id2 = await recordAgencySubaccountRevenue(db, 'agy_attr-agency', 'sub_attr_1', 2000, 10);

        const records = await db
          .prepare('SELECT * FROM agy_attribution_ledger WHERE agency_id = ? ORDER BY created_at ASC')
          .bind('agy_attr-agency')
          .all();
        expect(records.results).toHaveLength(2);
        expect(records.results[0].id).toBe(id1);
        expect(records.results[1].id).toBe(id2);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 2: BOUNDARY & CORNER CASES (25 Tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 2: Boundary & Corner Cases', () => {
    // ─── B1: Agency Slug Boundary Conditions ──────────────────────────────────
    describe('B1: Agency Slug Boundary Conditions', () => {
      it('B1.1 rejects empty string or whitespace-only slug', () => {
        expect(validateAgencySlug('').valid).toBe(false);
        expect(validateAgencySlug('   ').valid).toBe(false);
      });

      it('B1.2 boundary: accepts exactly 3-character minimal valid slug', () => {
        const res = validateAgencySlug('abc');
        expect(res.valid).toBe(true);
        expect(res.normalizedSlug).toBe('abc');
      });

      it('B1.3 boundary: accepts exactly 63-character maximum valid slug', () => {
        const slug63 = 'a'.repeat(63);
        const res = validateAgencySlug(slug63);
        expect(res.valid).toBe(true);
        expect(res.normalizedSlug).toBe(slug63);
      });

      it('B1.4 rejects slug with leading or trailing hyphens (-agency or agency-)', () => {
        expect(validateAgencySlug('-agency').valid).toBe(false);
        expect(validateAgencySlug('agency-').valid).toBe(false);
      });

      it('B1.5 rejects consecutive double hyphens (agency--network)', () => {
        expect(validateAgencySlug('agency--network').valid).toBe(false);
      });
    });

    // ─── B2: Compute Cap & Numeric Precision Boundaries ───────────────────────
    describe('B2: Compute Cap & Numeric Precision Boundaries', () => {
      it('B2.1 handles safe integer maximum MCU without numerical overflow', async () => {
        await db
          .prepare('INSERT INTO agy_tenant_configs (id, agency_id, org_id, agency_slug, quota_limit_mcu, quota_used_mcu, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .bind('cfg_big', 'agy_big', 'org_big', 'big-agency', Number.MAX_SAFE_INTEGER, 0, Date.now(), Date.now())
          .run();

        const deduction = await checkAndDeductComputeQuota(db, 'agy_big', 1000000000);
        expect(deduction.allowed).toBe(true);
        expect(deduction.quotaUsedMcu).toBe(1000000000);
      });

      it('B2.2 rejects zero requested MCU with INVALID_REQUESTED_MCU', async () => {
        const res = await checkAndDeductComputeQuota(db, 'agy_any', 0);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('INVALID_REQUESTED_MCU');
      });

      it('B2.3 rejects negative requested MCU with INVALID_REQUESTED_MCU', async () => {
        const res = await checkAndDeductComputeQuota(db, 'agy_any', -50);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('INVALID_REQUESTED_MCU');
      });

      it('B2.4 rejects non-finite number (Infinity) with INVALID_REQUESTED_MCU', async () => {
        const res = await checkAndDeductComputeQuota(db, 'agy_any', Number.POSITIVE_INFINITY);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('INVALID_REQUESTED_MCU');
      });

      it('B2.5 rejects NaN requested MCU with INVALID_REQUESTED_MCU', async () => {
        const res = await checkAndDeductComputeQuota(db, 'agy_any', Number.NaN);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('INVALID_REQUESTED_MCU');
      });
    });

    // ─── B3: YAML Parsing & AST Boundary Conditions ───────────────────────────
    describe('B3: YAML Parsing & AST Boundary Conditions', () => {
      it('B3.1 parses YAML with extensive Unicode characters (Vietnamese, Japanese)', () => {
        const unicodeYaml = `
schemaVersion: "1.0"
agent:
  id: "agent_bilingual"
  name: "Chuyên Gia Sáng Tạo Video 日本語"
  role: "video_specialist"
  maxAutonomyLevel: "L2"
compute:
  maxTokensPerRun: 4096
  maxComputeUnitsMcu: 100
permissions:
  allow: ["video:tạo", "video:xem"]
  deny: []
escalation:
  onQuotaExceeded: "halt"
  onDisallowedAction: "halt"
`;
        const parsed = parseAgentGovernanceYaml(unicodeYaml);
        expect(parsed.agent.name).toBe('Chuyên Gia Sáng Tạo Video 日本語');
        expect(parsed.permissions.allow).toContain('video:tạo');
      });

      it('B3.2 boundary: accepts document at exactly 512KB payload threshold', () => {
        const header = `
schemaVersion: "1.0"
agent: { id: "a", name: "b", role: "c", maxAutonomyLevel: "L1" }
compute: { maxTokensPerRun: 100, maxComputeUnitsMcu: 10 }
permissions: { allow: ["*"], deny: [] }
escalation: { onQuotaExceeded: "halt", onDisallowedAction: "halt" }
# `;
        const padLen = MAX_AGY_YAML_BYTES - Buffer.byteLength(header, 'utf8');
        const exact512K = header + 'x'.repeat(Math.max(0, padLen));
        expect(() => parseAgentGovernanceYaml(exact512K)).not.toThrow();
      });

      it('B3.3 boundary: rejects document at 512KB + 1 byte threshold', () => {
        const header = `
schemaVersion: "1.0"
agent: { id: "a", name: "b", role: "c", maxAutonomyLevel: "L1" }
compute: { maxTokensPerRun: 100, maxComputeUnitsMcu: 10 }
permissions: { allow: ["*"], deny: [] }
escalation: { onQuotaExceeded: "halt", onDisallowedAction: "halt" }
# `;
        const padLen = MAX_AGY_YAML_BYTES - Buffer.byteLength(header, 'utf8') + 1;
        const over512K = header + 'x'.repeat(Math.max(1, padLen));
        expect(() => parseAgentGovernanceYaml(over512K)).toThrow('PAYLOAD_TOO_LARGE');
      });

      it('B3.4 rejects empty YAML string with INVALID_SCHEMA', () => {
        expect(() => parseAgentGovernanceYaml('')).toThrow('INVALID_SCHEMA');
      });

      it('B3.5 rejects YAML document where root is array or primitive scalar', () => {
        expect(() => parseAgentGovernanceYaml('- item1\n- item2')).toThrow('INVALID_SCHEMA');
        expect(() => parseAgentGovernanceYaml('"just a string"')).toThrow('INVALID_SCHEMA');
      });
    });

    // ─── B4: Rate Limiting & Window Rollover Boundaries ───────────────────────
    describe('B4: Rate Limiting & Window Rollover Boundaries', () => {
      it('B4.1 boundary: exact transition at limit (req N allowed, req N+1 rejected)', () => {
        const engine = new AgencyRateLimitEngine();
        const now = 2000000;
        const limit = 5;
        for (let i = 0; i < limit; i++) {
          const res = engine.checkRateLimit('agy_edge', limit, now);
          expect(res.allowed).toBe(true);
          expect(res.remaining).toBe(limit - i - 1);
        }
        const rejected = engine.checkRateLimit('agy_edge', limit, now);
        expect(rejected.allowed).toBe(false);
        expect(rejected.remaining).toBe(0);
      });

      it('B4.2 handles 0-RPS configuration by blocking all requests', () => {
        const engine = new AgencyRateLimitEngine();
        const res = engine.checkRateLimit('agy_blocked', 0, 2000000);
        expect(res.allowed).toBe(false);
        expect(res.remaining).toBe(0);
      });

      it('B4.3 preserves rate limit counters across distinct agencies independently', () => {
        const engine = new AgencyRateLimitEngine();
        const now = 2000000;
        engine.checkRateLimit('agy_one', 1, now);
        // agy_one is exhausted
        expect(engine.checkRateLimit('agy_one', 1, now).allowed).toBe(false);
        // agy_two is unaffected
        expect(engine.checkRateLimit('agy_two', 1, now).allowed).toBe(true);
      });

      it('B4.4 slides window accurately when timestamps span millisecond boundary', () => {
        const engine = new AgencyRateLimitEngine();
        engine.checkRateLimit('agy_time', 2, 1000);
        engine.checkRateLimit('agy_time', 2, 1500);
        // At 2001ms, first request at 1000ms has expired (window is 1001-2001)
        expect(engine.checkRateLimit('agy_time', 2, 2001).allowed).toBe(true);
      });

      it('B4.5 resets agency specific state cleanly on demand', () => {
        const engine = new AgencyRateLimitEngine();
        engine.checkRateLimit('agy_reset', 1, 1000);
        expect(engine.checkRateLimit('agy_reset', 1, 1000).allowed).toBe(false);
        engine.reset('agy_reset');
        expect(engine.checkRateLimit('agy_reset', 1, 1000).allowed).toBe(true);
      });
    });

    // ─── B5: Security & Isolation Adversarial Boundaries ──────────────────────
    describe('B5: Security & Isolation Adversarial Boundaries', () => {
      it('B5.1 rejects token when payload is swapped with another agency ID', () => {
        const validTokenA = generateAgyTenantToken(SECRET_KEY, 'agy_a', ['action:run'], 3600);
        // Attacker attempts to change agencyId to agy_b while keeping signature
        const forgedToken = { ...validTokenA, agencyId: 'agy_b' };
        expect(verifyAgyTenantToken(SECRET_KEY, forgedToken).valid).toBe(false);
      });

      it('B5.2 rejects token when permissions array is escalated', () => {
        const regularToken = generateAgyTenantToken(SECRET_KEY, 'agy_a', ['video:read'], 3600);
        const escalatedToken = { ...regularToken, permissions: ['video:read', 'admin:super'] };
        expect(verifyAgyTenantToken(SECRET_KEY, escalatedToken).valid).toBe(false);
      });

      it('B5.3 blocks SQL injection strings in agency slug lookup', () => {
        const sqlInjSlugs = [
          "agency' OR '1'='1",
          'agency; DROP TABLE agy_tenant_configs;--',
          'agency" UNION SELECT * FROM users--',
        ];
        for (const slug of sqlInjSlugs) {
          expect(validateAgencySlug(slug).valid).toBe(false);
        }
      });

      it('B5.4 matches permissions case-insensitively preventing capitalization bypass', () => {
        expect(matchPermission('video:generate', 'VIDEO:GENERATE')).toBe(true);
        expect(matchPermission('BILLING:*', 'billing:mutate')).toBe(true);
      });

      it('B5.5 rejects wildcard trailing bypass (e.g. video:* should not match video_extra:read)', () => {
        expect(matchPermission('video:*', 'video:read')).toBe(true);
        expect(matchPermission('video:*', 'video_extra:read')).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 3: CROSS-FEATURE PAIRWISE COMBINATIONS (6 Tests)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 3: Cross-Feature Pairwise Combinations', () => {
    it('C1: Domain Resolution -> Token Validation -> AGY Policy -> Audit Ledger', async () => {
      // 1. Resolve domain
      const hostRes = resolveTenantFromHostname('quantum.agencyos.network');
      expect(hostRes.isAgencySubdomain).toBe(true);
      const agencyId = hostRes.agencyId!;

      // 2. Generate and verify tenant token
      const token = generateAgyTenantToken(SECRET_KEY, agencyId, ['campaign:create', 'render:*'], 3600);
      expect(verifyAgyTenantToken(SECRET_KEY, token).valid).toBe(true);

      // 3. Evaluate AGY policy
      const policy: AgentGovernanceYaml = {
        schemaVersion: '1.0',
        agent: { id: 'agent_q', name: 'Q Agent', role: 'creator', maxAutonomyLevel: 'L2' },
        compute: { maxTokensPerRun: 4000, maxComputeUnitsMcu: 50 },
        permissions: { allow: ['render:*'], deny: ['render:delete'] },
        escalation: { onQuotaExceeded: 'halt', onDisallowedAction: 'halt' },
      };
      const req: PolicyEvaluationRequest = {
        agencyId,
        agentId: 'agent_q',
        action: 'render:scene',
        requestedAutonomy: 'L1',
        requestedComputeUnits: 25,
      };
      const verdict = evaluateAgyPolicy(policy, req);
      expect(verdict.allowed).toBe(true);

      // 4. Log to Audit Ledger
      const auditId = await logPolicyEvaluationToLedger(db, req, verdict);
      const logRow = await db.prepare('SELECT * FROM agy_policy_audit_ledger WHERE id = ?').bind(auditId).first<{ evaluation_sha256: string }>();
      expect(logRow?.evaluation_sha256).toBe(verdict.evaluationSha256);
    });

    it('C2: Onboarding Wizard -> Custom Domain -> Seed Agent -> AGY Binding', async () => {
      // 1. Onboarding
      const onboard = await executeAgencyOnboarding(db, {
        agencyName: 'Omni Media',
        agencySlug: 'omni-media',
        customDomain: 'app.omnimedia.net',
        primaryColor: '#8B5CF6',
        seedAgents: [{ role: 'lead_creator', template: 'reels_pro', maxAutonomy: 'L2' }],
      });
      expect(onboard.success).toBe(true);

      // 2. Resolve custom domain
      const lookup = (domain: string) => {
        if (domain === 'app.omnimedia.net') {
          return { agencyId: onboard.agencyId, orgId: onboard.orgId, agencySlug: onboard.slug };
        }
        return null;
      };
      const hostRes = resolveTenantFromHostname('app.omnimedia.net', lookup);
      expect(hostRes.isCustomDomain).toBe(true);
      expect(hostRes.agencyId).toBe('agy_omni-media');

      // 3. Inspect provisioned agent and verify policy evaluation
      const agent = await db
        .prepare('SELECT * FROM agy_seed_agents WHERE agency_id = ? AND role = ?')
        .bind(onboard.agencyId, 'lead_creator')
        .first<{ max_autonomy: string }>();
      expect(agent?.max_autonomy).toBe('L2');
    });

    it('C3: Concurrency Rate Limiter (429) -> Quota Exhaustion (402) -> Escalation Trigger', async () => {
      await executeAgencyOnboarding(db, {
        agencyName: 'Burst Agency',
        agencySlug: 'burst-agency',
        seedAgents: [],
      });
      // Set tight quota
      await db
        .prepare('UPDATE agy_tenant_configs SET quota_limit_mcu = 10, quota_used_mcu = 0 WHERE agency_id = ?')
        .bind('agy_burst-agency')
        .run();

      const rateLimiter = new AgencyRateLimitEngine();
      // 1. Trigger rate limit
      for (let i = 0; i < 3; i++) {
        rateLimiter.checkRateLimit('agy_burst-agency', 3, 5000);
      }
      const rpsBlocked = rateLimiter.checkRateLimit('agy_burst-agency', 3, 5000);
      expect(rpsBlocked.allowed).toBe(false);

      // 2. Consume remaining quota and trigger exhaustion
      await checkAndDeductComputeQuota(db, 'agy_burst-agency', 10);
      const quotaExhausted = await checkAndDeductComputeQuota(db, 'agy_burst-agency', 5);
      expect(quotaExhausted.allowed).toBe(false);
      expect(quotaExhausted.reason).toBe('QUOTA_EXHAUSTED');
    });

    it('C4: Subaccount Attribution -> Agency MCU Metering -> Portal Dashboard Aggregation', async () => {
      await executeAgencyOnboarding(db, {
        agencyName: 'Matrix Agency',
        agencySlug: 'matrix-agency',
        seedAgents: [{ role: 'agent_1', template: 't1', maxAutonomy: 'L1' }],
      });
      await db
        .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, mcu_allocated, mcu_used, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .bind('sub_matrix_1', 'agy_matrix-agency', 'Nike Global', 5000, 0, Date.now())
        .run();

      // Record attribution
      await recordAgencySubaccountRevenue(db, 'agy_matrix-agency', 'sub_matrix_1', 49900, 150); // $499.00, 150 MCU

      const overview = await fetchAgencyPortalOverview(db, 'agy_matrix-agency');
      expect(overview.totalClients).toBe(1);
      expect(overview.totalMcuConsumed).toBe(150);
      expect(overview.estimatedMrrUsd).toBe(499);
    });

    it('C5: L2 Autonomy Request -> Single Run Compute Limit Check -> Ledger Auditability', async () => {
      const policy: AgentGovernanceYaml = {
        schemaVersion: '1.0',
        agent: { id: 'agent_audited', name: 'Audited Agent', role: 'writer', maxAutonomyLevel: 'L2' },
        compute: { maxTokensPerRun: 2048, maxComputeUnitsMcu: 10 },
        permissions: { allow: ['write:*'], deny: [] },
        escalation: { onQuotaExceeded: 'halt', onDisallowedAction: 'halt' },
      };

      const req: PolicyEvaluationRequest = {
        agencyId: 'agy_audit_chain',
        agentId: 'agent_audited',
        action: 'write:script',
        requestedAutonomy: 'L2',
        requestedComputeUnits: 8,
      };

      const verdict = evaluateAgyPolicy(policy, req);
      expect(verdict.allowed).toBe(true);

      const auditId = await logPolicyEvaluationToLedger(db, req, verdict);
      const log = await db.prepare('SELECT * FROM agy_policy_audit_ledger WHERE id = ?').bind(auditId).first<{ evaluation_sha256: string }>();
      expect(log?.evaluation_sha256).toBe(verdict.evaluationSha256);
    });

    it('C6: Malicious Subdomain Spoofing + Denied Action Defense Pipeline', async () => {
      // 1. Attacker tries to impersonate platform admin subdomain
      const spoofAttempt = resolveTenantFromHostname('admin.agencyos.network');
      expect(spoofAttempt.isAgencySubdomain).toBe(false);
      expect(spoofAttempt.agencyId).toBeNull();

      // 2. Attacker crafts forged policy request trying to execute denied action
      const policy: AgentGovernanceYaml = {
        schemaVersion: '1.0',
        agent: { id: 'agent_rogue', name: 'Rogue', role: 'bot', maxAutonomyLevel: 'L1' },
        compute: { maxTokensPerRun: 1000, maxComputeUnitsMcu: 10 },
        permissions: { allow: ['read:*'], deny: ['system:*', 'billing:*'] },
        escalation: { onQuotaExceeded: 'halt', onDisallowedAction: 'escalate_human' },
      };
      const rogueReq: PolicyEvaluationRequest = {
        agencyId: 'agy_victim',
        agentId: 'agent_rogue',
        action: 'system:wipe_database',
        requestedAutonomy: 'L4', // Exceeds L1
        requestedComputeUnits: 10,
      };
      const verdict = evaluateAgyPolicy(policy, rogueReq);
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('ACTION_EXPLICITLY_DENIED');
      expect(verdict.escalationTriggered).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIER 4: REAL-WORLD AGENCY SCENARIOS (5 Workflows)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Tier 4: Real-World Agency Scenarios', () => {
    it('Scenario 1: Boutique Creative Agency Complete Lifecycle', async () => {
      // 1. Agency Onboarding (Profile, Branding, Domain, Seed Agents)
      const onboarding = await executeAgencyOnboarding(db, {
        agencyName: 'Aura Creative Studio',
        agencySlug: 'aura-creative',
        customDomain: 'app.auracreative.vn',
        primaryColor: '#EC4899', // Pink theme
        seedAgents: [
          { role: 'video_creator', template: 'ugc_viral_v3', maxAutonomy: 'L2' },
          { role: 'ugc_reviewer', template: 'quality_gate_v1', maxAutonomy: 'L1' },
          { role: 'outreach_bot', template: 'tiktok_dm_v1', maxAutonomy: 'L2' },
        ],
      });
      expect(onboarding.success).toBe(true);
      const agencyId = onboarding.agencyId;

      // 2. Onboard 3 Client Subaccounts
      for (const client of ['Highlands Coffee', 'VinFast Showroom', 'Shopee Seller Pro']) {
        await db
          .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, mcu_allocated, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(`sub_${client.replace(/\s+/g, '_').toLowerCase()}`, agencyId, client, 2000, Date.now())
          .run();
      }

      // 3. Video Creator Agent runs production job
      const policy: AgentGovernanceYaml = {
        schemaVersion: '1.0',
        agent: { id: 'agent_aura_creator', name: 'Aura Creator', role: 'video_creator', maxAutonomyLevel: 'L2' },
        compute: { maxTokensPerRun: 8192, maxComputeUnitsMcu: 100 },
        permissions: { allow: ['video:*', 'ugc:*'], deny: ['billing:*'] },
        escalation: { onQuotaExceeded: 'halt', onDisallowedAction: 'escalate_human' },
      };
      const jobReq: PolicyEvaluationRequest = {
        agencyId,
        agentId: 'agent_aura_creator',
        action: 'video:generate',
        requestedAutonomy: 'L2',
        requestedComputeUnits: 30,
      };
      const verdict = evaluateAgyPolicy(policy, jobReq);
      expect(verdict.allowed).toBe(true);

      // Deduct agency compute quota and log audit
      const quotaDeduction = await checkAndDeductComputeQuota(db, agencyId, 30);
      expect(quotaDeduction.allowed).toBe(true);
      await logPolicyEvaluationToLedger(db, jobReq, verdict);

      // Attribute revenue from client
      await recordAgencySubaccountRevenue(db, agencyId, 'sub_vinfast_showroom', 35000, 30, 'campaign_run'); // $350

      // 4. Verify Final Agency Portal Dashboard State
      const portal = await fetchAgencyPortalOverview(db, agencyId);
      expect(portal.totalClients).toBe(3);
      expect(portal.activeCampaigns).toBe(3);
      expect(portal.totalMcuConsumed).toBe(60); // 30 from checkAndDeduct + 30 from recordAgencySubaccountRevenue
      expect(portal.estimatedMrrUsd).toBe(350);
    });

    it('Scenario 2: High-Volume Media Agency Burst & Quota Escalation', async () => {
      const agencyId = 'agy_pulse-media';
      await executeAgencyOnboarding(db, {
        agencyName: 'Pulse Media',
        agencySlug: 'pulse-media',
        seedAgents: [],
      });
      // Cap agency quota to 50 MCU
      await db
        .prepare('UPDATE agy_tenant_configs SET quota_limit_mcu = 50, quota_used_mcu = 0, rate_limit_rps = 10 WHERE agency_id = ?')
        .bind(agencyId)
        .run();

      const rateLimiter = new AgencyRateLimitEngine();
      const now = Date.now();

      // Burst of 12 requests (limit is 10 RPS)
      let allowedCount = 0;
      let blockedCount = 0;
      for (let i = 0; i < 12; i++) {
        const res = rateLimiter.checkRateLimit(agencyId, 10, now);
        if (res.allowed) allowedCount++;
        else blockedCount++;
      }
      expect(allowedCount).toBe(10);
      expect(blockedCount).toBe(2);

      // Agent policy with escalation
      const policy: AgentGovernanceYaml = {
        schemaVersion: '1.0',
        agent: { id: 'agent_pulse', name: 'Pulse Bot', role: 'mass_creator', maxAutonomyLevel: 'L2' },
        compute: { maxTokensPerRun: 4096, maxComputeUnitsMcu: 40 },
        permissions: { allow: ['*'], deny: [] },
        escalation: { onQuotaExceeded: 'request_approval', onDisallowedAction: 'halt' },
      };

      // Request 1: 30 MCU -> Allowed
      const deduction1 = await checkAndDeductComputeQuota(db, agencyId, 30);
      expect(deduction1.allowed).toBe(true);

      // Request 2: 30 MCU -> Exceeds remaining 20 MCU in agency tenant
      const deduction2 = await checkAndDeductComputeQuota(db, agencyId, 30);
      expect(deduction2.allowed).toBe(false);
      expect(deduction2.reason).toBe('QUOTA_EXHAUSTED');

      // Admin expands quota to 200 MCU
      await db
        .prepare('UPDATE agy_tenant_configs SET quota_limit_mcu = 200, updated_at = ? WHERE agency_id = ?')
        .bind(Date.now(), agencyId)
        .run();

      // Request 3: Retry succeeds
      const deduction3 = await checkAndDeductComputeQuota(db, agencyId, 30);
      expect(deduction3.allowed).toBe(true);
    });

    it('Scenario 3: Adversarial Multi-Tenant Breach & Injection Defense', async () => {
      // Setup victim and attacker agencies
      await executeAgencyOnboarding(db, { agencyName: 'Victim Agency', agencySlug: 'victim-agency', seedAgents: [] });
      await executeAgencyOnboarding(db, { agencyName: 'Attacker Agency', agencySlug: 'attacker-agency', seedAgents: [] });

      // Add secret client to victim
      await db
        .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, created_at) VALUES (?, ?, ?, ?)')
        .bind('sub_confidential', 'agy_victim-agency', 'Classified Client Corp', Date.now())
        .run();

      // Attack 1: Attacker attempts to forge token with victim agencyId
      const attackerToken = generateAgyTenantToken('attacker-different-secret-key-1234', 'agy_victim-agency', ['*'], 3600);
      const verifyVictimKey = verifyAgyTenantToken(SECRET_KEY, attackerToken);
      expect(verifyVictimKey.valid).toBe(false);

      // Attack 2: Attacker attempts SQL injection in subaccount deletion
      const deleteResult = await db
        .prepare('DELETE FROM agy_subaccounts WHERE id = ? AND agency_id = ?')
        .bind("sub_confidential' OR 1=1--", 'agy_attacker-agency')
        .run();
      expect(deleteResult.meta.changes).toBe(0);

      // Attack 3: Victim record remains untouched
      const victimRecord = await db
        .prepare('SELECT * FROM agy_subaccounts WHERE id = ?')
        .bind('sub_confidential')
        .first<{ client_name: string }>();
      expect(victimRecord?.client_name).toBe('Classified Client Corp');
    });

    it('Scenario 4: Enterprise White-Label Reseller with Multi-Subaccount Attribution', async () => {
      const resellerId = 'agy_reseller-pro';
      await executeAgencyOnboarding(db, {
        agencyName: 'Reseller Pro Global',
        agencySlug: 'reseller-pro',
        customDomain: 'portal.resellerpro.com',
        primaryColor: '#059669', // Emerald
        seedAgents: [{ role: 'account_agent', template: 'multi_tenant_v1', maxAutonomy: 'L2' }],
      });

      // Reseller provisions 5 client subaccounts
      const subaccountIds = ['sub_c1', 'sub_c2', 'sub_c3', 'sub_c4', 'sub_c5'];
      for (const id of subaccountIds) {
        await db
          .prepare('INSERT INTO agy_subaccounts (id, agency_id, client_name, mcu_allocated, created_at) VALUES (?, ?, ?, ?, ?)')
          .bind(id, resellerId, `Enterprise Client ${id}`, 5000, Date.now())
          .run();
      }

      // Record attribution for all 5 subaccounts
      let totalAmountCents = 0;
      for (let i = 0; i < subaccountIds.length; i++) {
        const feeCents = (i + 1) * 10000; // $100, $200, $300, $400, $500
        totalAmountCents += feeCents;
        await recordAgencySubaccountRevenue(db, resellerId, subaccountIds[i], feeCents, 20);
      }

      // Check portal metrics
      const overview = await fetchAgencyPortalOverview(db, resellerId);
      expect(overview.totalClients).toBe(5);
      expect(overview.totalMcuConsumed).toBe(100); // 5 * 20
      expect(overview.estimatedMrrUsd).toBe(totalAmountCents / 100); // $1500 MRR
    });

    it('Scenario 5: Autonomy Violation & Human Escalation Workflow', async () => {
      const agencyId = 'agy_governance-strict';
      await executeAgencyOnboarding(db, {
        agencyName: 'Strict Governance Agency',
        agencySlug: 'governance-strict',
        seedAgents: [],
      });

      // Policy: Seed agent has maxAutonomyLevel L1, onDisallowedAction is escalate_human
      const strictPolicy: AgentGovernanceYaml = {
        schemaVersion: '1.0',
        agent: { id: 'agent_junior', name: 'Junior Bot', role: 'intern', maxAutonomyLevel: 'L1' },
        compute: { maxTokensPerRun: 2048, maxComputeUnitsMcu: 10 },
        permissions: { allow: ['draft:create', 'draft:edit'], deny: ['publish:live', 'campaign:launch'] },
        escalation: { onQuotaExceeded: 'halt', onDisallowedAction: 'escalate_human' },
      };

      // 1. Junior Agent attempts high-risk L4 action 'campaign:launch'
      const launchReq: PolicyEvaluationRequest = {
        agencyId,
        agentId: 'agent_junior',
        action: 'campaign:launch',
        requestedAutonomy: 'L4', // Exceeds L1
        requestedComputeUnits: 8,
      };

      // 2. Policy engine rejects action and triggers escalation
      const verdict = evaluateAgyPolicy(strictPolicy, launchReq, 'L4');
      expect(verdict.allowed).toBe(false);
      expect(verdict.reason).toBe('ACTION_EXPLICITLY_DENIED');
      expect(verdict.escalationTriggered).toBe(true);

      // 3. Immutable audit record logged to D1 ledger
      const auditId = await logPolicyEvaluationToLedger(db, launchReq, verdict);
      const auditRow = await db
        .prepare('SELECT * FROM agy_policy_audit_ledger WHERE id = ?')
        .bind(auditId)
        .first<{ allowed: number; escalation_triggered: number; reason: string }>();

      expect(auditRow?.allowed).toBe(0);
      expect(auditRow?.escalation_triggered).toBe(1);
      expect(auditRow?.reason).toBe('ACTION_EXPLICITLY_DENIED');

      // 4. Human agency owner approves manual override using elevated L4 credential
      const seniorPolicy: AgentGovernanceYaml = {
        ...strictPolicy,
        agent: { id: 'owner_senior', name: 'Agency Owner', role: 'admin', maxAutonomyLevel: 'L4' },
        permissions: { allow: ['*'], deny: [] },
      };
      const ownerReq: PolicyEvaluationRequest = {
        ...launchReq,
        agentId: 'owner_senior',
      };
      const ownerVerdict = evaluateAgyPolicy(seniorPolicy, ownerReq, 'L4');
      expect(ownerVerdict.allowed).toBe(true);
      expect(ownerVerdict.reason).toBe('POLICY_APPROVED');

      // Log owner approval to audit ledger
      const ownerAuditId = await logPolicyEvaluationToLedger(db, ownerReq, ownerVerdict);
      const ownerRow = await db
        .prepare('SELECT allowed FROM agy_policy_audit_ledger WHERE id = ?')
        .bind(ownerAuditId)
        .first<{ allowed: number }>();
      expect(ownerRow?.allowed).toBe(1);
    });
  });
});

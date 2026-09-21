/**
 * Adversarial Workflow & Edge-Case Challenger Test Suite
 * Phase 20: 100/100 Automated Customer Handover, Project Closeout & Operational Acceptance Engine
 *
 * EMPIRICAL CHALLENGER VERIFICATION:
 * 1. Double Sign-Off Prevention (Tamper-evident Certificate Immutability)
 * 2. Unauthorized Access Protection (RBAC & auth on server actions)
 * 3. Invalid Signer Inputs & Whitespace Bypasses
 * 4. Runbook Deep-link & 404 Fallback
 * 5. Diagnostic Verify API Auth & Authorization Adversarial Gate
 * 6. Partial Check Failures & Exception Resilience
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import type { D1Database } from '@/seed/db/client';
import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificate,
  VerificationRunReport,
} from '@/seed/handover/handover-types';
import { GET as getVerifyRoute, POST as postVerifyRoute } from '@/app/api/admin/handover/verify/route';
import * as requireAdminModule from '@/seed/auth/require-admin';
import * as orchestratorModule from '@/forest/handover/verification-orchestrator';

// Mock dependencies for server actions and database
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn(),
}));

vi.mock('@/tree/handover/day1-verification-engine', () => ({
  runAllDay1Probes: vi.fn().mockResolvedValue([
    {
      checkpointId: 'edge_responsiveness',
      name: 'Edge Responsiveness Probe',
      nameVi: 'Kiểm Tra Máy Chủ Edge',
      category: 'edge',
      status: 'PASS',
      latencyMs: 12,
      details: 'Smoke OK',
    },
  ]),
}));

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdmin } from '@/seed/auth/is-user-admin';
import {
  signHandoverAcceptanceAction,
  triggerHandoverVerificationAction,
  exportSanitizedEnvAction,
} from '@/land/actions/handover-actions';
import {
  recordHandoverAcceptance,
} from '@/tree/handover/customer-handover-service';
import {
  getRunbookBySlug,
  listRunbooks,
  exportRunbookMarkdown,
  exportRunbookHtml,
} from '@/tree/handover/runbook-catalog-service';
import RunbookDetailPageRoute from '@/app/[locale]/dashboard/docs/runbooks/[slug]/page';

const mockedGetD1 = vi.mocked(getD1);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);
const mockedIsUserAdmin = vi.mocked(isUserAdmin);

describe('Adversarial Challenger Suite: Phase 20 Handover Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // CHALLENGE 1: Double Sign-Off Prevention
  // =========================================================================
  describe('1. Double Sign-Off Prevention', () => {
    it('EMPIRICAL PROBE: Checks if recordHandoverAcceptance rejects or preserves already accepted handover', async () => {
      const initialTimestamp = 1726800000000;
      const initialHash = 'a'.repeat(64);

      let storedHandover: CustomerHandoverRecord = {
        id: 'handover_test_01',
        customer_user_id: 'usr_customer_vip',
        agency_name: 'Acme Media Corp',
        agency_type: 'b2b_saas',
        tier: 'SCALE',
        starter_sops: '["sop-01","sop-02"]',
        magic_link_token: null,
        magic_link_expires_at: null,
        created_by_admin_id: 'usr_admin_01',
        created_at: 1726700000000,
        welcome_email_sent_at: 1726700000000,
        customer_first_login_at: 1726750000000,
        customer_first_sop_install_at: 1726760000000,
        customer_first_run_at: 1726770000000,
        status: 'active',
        source: 'manual',
        trigger_payment_id: null,
        tenant_id: 'tenant_acme',
        signer_name: 'Original CEO Alice',
        signer_email: 'alice@acme.com',
        signer_role: 'CEO',
        certificate_hash: initialHash,
        acceptance_status: 'accepted', // ALREADY ACCEPTED!
        verification_results: '{"overallVerdict":"PASS"}',
        signed_at: initialTimestamp,
        verification_passed_at: initialTimestamp,
        certificate_r2_key: null,
        notes: 'Initial formal sign-off',
      };

      const storedCertificates: Record<string, HandoverCertificate> = {
        handover_test_01: {
          id: 'cert_handover_test_01_original',
          handoverId: 'handover_test_01',
          tenantId: 'tenant_acme',
          customerName: 'Acme Media Corp',
          customerEmail: 'alice@acme.com',
          signerName: 'Original CEO Alice',
          signerEmail: 'alice@acme.com',
          signerRole: 'CEO',
          tier: 'SCALE',
          deployedSha: 'initial_sha',
          certificateSha256: initialHash,
          verificationResults: '{"overallVerdict":"PASS"}',
          contentMarkdown: '# Certified Original',
          metadataJson: '{}',
          createdAt: initialTimestamp,
        },
      };

      const mockDb = {
        prepare: vi.fn((sql: string) => {
          return {
            bind: vi.fn((...args: unknown[]) => {
              return {
                first: vi.fn(async () => {
                  if (sql.includes('FROM customer_handovers WHERE id = ?1 OR customer_user_id = ?1')) {
                    const id = String(args[0]);
                    return storedHandover.id === id || storedHandover.customer_user_id === id ? storedHandover : null;
                  }
                  if (sql.includes('FROM handover_certificates')) {
                    const id = String(args[0]);
                    return storedCertificates[id] ?? null;
                  }
                  return null;
                }),
                run: vi.fn(async () => {
                  if (sql.includes('UPDATE customer_handovers SET')) {
                    storedHandover = {
                      ...storedHandover,
                      signer_name: String(args[0]),
                      signer_email: String(args[1]),
                      signer_role: String(args[2]),
                      certificate_hash: String(args[3]),
                      signed_at: Number(args[5]),
                      notes: args[7] ? String(args[7]) : null,
                    };
                  }
                  return { success: true };
                }),
              };
            }),
          };
        }),
      } as unknown as D1Database;

      const secondInput: HandoverAcceptanceInput = {
        handoverId: 'handover_test_01',
        signerName: 'Mallory Attacker',
        signerEmail: 'mallory@attacker.io',
        signerRole: 'Impostor',
        notes: 'Malicious second sign-off overwrite',
      };

      let threwError = false;
      try {
        await recordHandoverAcceptance(mockDb, secondInput);
      } catch {
        threwError = true;
      }

      const didOverwriteSigner = storedHandover.signer_name === 'Mallory Attacker';
      const didOverwriteTimestamp = storedHandover.signed_at !== initialTimestamp;
      const didOverwriteHash = storedHandover.certificate_hash !== initialHash;

      expect({
        protectedAgainstOverwrite: threwError || (!didOverwriteSigner && !didOverwriteTimestamp && !didOverwriteHash),
      }).toEqual({
        protectedAgainstOverwrite: true,
      });
    });

    it('EMPIRICAL PROBE: Checks signHandoverAcceptanceAction behavior on already accepted handover', async () => {
      mockedGetCurrentUser.mockResolvedValue({
        id: 'usr_customer_vip',
        email: 'alice@acme.com',
        name: 'Alice',
        role: 'user',
      } as any);

      const acceptedHandover: CustomerHandoverRecord = {
        id: 'handover_accepted_01',
        customer_user_id: 'usr_customer_vip',
        agency_name: 'Acme Media Corp',
        agency_type: 'b2b_saas',
        tier: 'SCALE',
        starter_sops: '[]',
        magic_link_token: null,
        magic_link_expires_at: null,
        created_by_admin_id: 'admin_1',
        created_at: 1000,
        welcome_email_sent_at: null,
        customer_first_login_at: null,
        customer_first_sop_install_at: null,
        customer_first_run_at: null,
        status: 'active',
        source: 'manual',
        trigger_payment_id: null,
        tenant_id: 'tenant_acme',
        signer_name: 'Original Signer',
        signer_email: 'alice@acme.com',
        signer_role: 'CEO',
        certificate_hash: 'hash_original',
        acceptance_status: 'accepted', // ALREADY SIGNED
        verification_results: null,
        signed_at: 5000,
        verification_passed_at: null,
        certificate_r2_key: null,
        notes: null,
      };

      const mockDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => acceptedHandover),
            run: vi.fn(async () => ({ success: true })),
          })),
        })),
      } as unknown as D1Database;

      mockedGetD1.mockResolvedValue(mockDb);

      const result = await signHandoverAcceptanceAction({
        handoverId: 'handover_accepted_01',
        signerName: 'Second Signer',
        signerEmail: 'second@acme.com',
        signerRole: 'CTO',
      });

      if (result.ok) {
        expect(result.value).toBeDefined();
        expect(result.value.record.signer_name).not.toBe('Second Signer');
      } else {
        expect(['ALREADY_ACCEPTED', 'ALREADY_SIGNED']).toContain(result.error.code);
      }
    });
  });

  // =========================================================================
  // CHALLENGE 2: Unauthorized Access Protection
  // =========================================================================
  describe('2. Unauthorized Access Protection', () => {
    it('Sub-test 2.1: Rejects unauthenticated callers on all 3 server actions', async () => {
      mockedGetCurrentUser.mockResolvedValue(null);

      const signRes = await signHandoverAcceptanceAction({
        handoverId: 'handover_01',
        signerName: 'Ghost',
        signerEmail: 'ghost@example.com',
        signerRole: 'CEO',
      });
      expect(signRes.ok).toBe(false);
      if (!signRes.ok) {
        expect(signRes.error.code).toBe('UNAUTHORIZED');
      }

      const verifyRes = await triggerHandoverVerificationAction('handover_01');
      expect(verifyRes.ok).toBe(false);
      if (!verifyRes.ok) {
        expect(verifyRes.error.code).toBe('UNAUTHORIZED');
      }

      const exportRes = await exportSanitizedEnvAction();
      expect(exportRes.ok).toBe(false);
      if (!exportRes.ok) {
        expect(exportRes.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('Sub-test 2.2: Rejects non-admin users from exportSanitizedEnvAction', async () => {
      mockedGetCurrentUser.mockResolvedValue({
        id: 'usr_regular_client',
        email: 'regular@client.io',
        name: 'Regular Customer',
        role: 'user',
      } as any);
      mockedIsUserAdmin.mockResolvedValue(false);

      const exportRes = await exportSanitizedEnvAction();
      expect(exportRes.ok).toBe(false);
      if (!exportRes.ok) {
        expect(['FORBIDDEN', 'UNAUTHORIZED', 'ADMIN_REQUIRED']).toContain(exportRes.error.code);
      }
    });

    it('Sub-test 2.3: Rejects non-admin users from triggerHandoverVerificationAction', async () => {
      mockedGetCurrentUser.mockResolvedValue({
        id: 'usr_regular_client',
        email: 'regular@client.io',
        name: 'Regular Customer',
        role: 'user',
      } as any);
      mockedIsUserAdmin.mockResolvedValue(false);

      const verifyRes = await triggerHandoverVerificationAction('handover_01');
      expect(verifyRes.ok).toBe(false);
      if (!verifyRes.ok) {
        expect(['FORBIDDEN', 'UNAUTHORIZED', 'ADMIN_REQUIRED']).toContain(verifyRes.error.code);
      }
    });

    it('Sub-test 2.4: Cross-tenant signing protection: User B cannot sign User A handover', async () => {
      mockedGetCurrentUser.mockResolvedValue({
        id: 'usr_tenant_b',
        email: 'attacker@b.com',
        name: 'Attacker B',
        role: 'user',
      } as any);
      mockedIsUserAdmin.mockResolvedValue(false);

      const handoverTenantA: CustomerHandoverRecord = {
        id: 'handover_tenant_a',
        customer_user_id: 'usr_tenant_a',
        agency_name: 'Agency A',
        agency_type: 'b2b_saas',
        tier: 'SCALE',
        starter_sops: '[]',
        magic_link_token: null,
        magic_link_expires_at: null,
        created_by_admin_id: 'admin_1',
        created_at: 1000,
        welcome_email_sent_at: null,
        customer_first_login_at: null,
        customer_first_sop_install_at: null,
        customer_first_run_at: null,
        status: 'active',
        source: 'manual',
        trigger_payment_id: null,
        tenant_id: 'tenant_a_id',
        signer_name: null,
        signer_email: null,
        signer_role: null,
        certificate_hash: null,
        acceptance_status: 'pending',
        verification_results: null,
        signed_at: null,
        verification_passed_at: null,
        certificate_r2_key: null,
        notes: null,
      };

      const mockDb = {
        prepare: vi.fn(() => ({
          bind: vi.fn(() => ({
            first: vi.fn(async () => handoverTenantA),
            run: vi.fn(async () => ({ success: true })),
          })),
        })),
      } as unknown as D1Database;
      mockedGetD1.mockResolvedValue(mockDb);

      const signRes = await signHandoverAcceptanceAction({
        handoverId: 'handover_tenant_a',
        signerName: 'Attacker B',
        signerEmail: 'attacker@b.com',
        signerRole: 'CEO',
      });

      expect(signRes.ok).toBe(false);
      if (!signRes.ok) {
        expect(['FORBIDDEN', 'UNAUTHORIZED', 'TENANT_MISMATCH']).toContain(signRes.error.code);
      }
    });
  });

  // =========================================================================
  // CHALLENGE 3: Invalid Signer Inputs
  // =========================================================================
  describe('3. Invalid Signer Inputs', () => {
    beforeEach(() => {
      mockedGetCurrentUser.mockResolvedValue({
        id: 'usr_admin',
        email: 'admin@sophia.io',
        role: 'admin',
      } as any);
      mockedIsUserAdmin.mockResolvedValue(true);
    });

    it('Rejects empty or whitespace-only signerName ("   ")', async () => {
      const res = await signHandoverAcceptanceAction({
        handoverId: 'handover_01',
        signerName: '    ',
        signerEmail: 'ceo@agency.com',
        signerRole: 'CEO',
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_INPUT');
      }
    });

    it('Rejects invalid email format ("not-an-email")', async () => {
      const res = await signHandoverAcceptanceAction({
        handoverId: 'handover_01',
        signerName: 'Jane Doe',
        signerEmail: 'not-an-email',
        signerRole: 'CEO',
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_INPUT');
      }
    });

    it('Rejects empty or whitespace handoverId', async () => {
      const res = await signHandoverAcceptanceAction({
        handoverId: '   ',
        signerName: 'Jane Doe',
        signerEmail: 'jane@agency.com',
        signerRole: 'CEO',
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_INPUT');
      }
    });

    it('Rejects invalid signer roles ("hacker_role" or empty)', async () => {
      const res = await signHandoverAcceptanceAction({
        handoverId: 'handover_01',
        signerName: 'Jane Doe',
        signerEmail: 'jane@agency.com',
        signerRole: 'invalid_malicious_role',
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_INPUT');
      }
    });
  });

  // =========================================================================
  // CHALLENGE 4: Runbook Deep-link & Fallback
  // =========================================================================
  describe('4. Runbook Deep-link & Fallback', () => {
    it('Gracefully returns null for non-existent runbook slugs', () => {
      expect(getRunbookBySlug('this-slug-does-not-exist')).toBeNull();
      expect(getRunbookBySlug('')).toBeNull();
      expect(getRunbookBySlug('    ')).toBeNull();
      expect(getRunbookBySlug('../../../etc/passwd')).toBeNull();
      expect(getRunbookBySlug('__proto__')).toBeNull();
    });

    it('exportRunbookMarkdown and exportRunbookHtml return null on invalid slugs without throwing', () => {
      expect(exportRunbookMarkdown('invalid-slug')).toBeNull();
      expect(exportRunbookHtml('invalid-slug')).toBeNull();
      expect(exportRunbookMarkdown('')).toBeNull();
      expect(exportRunbookHtml('')).toBeNull();
    });

    it('RunbookDetailPageRoute server component triggers notFound() for invalid slugs without unhandled crash', async () => {
      await expect(
        RunbookDetailPageRoute({
          params: Promise.resolve({ locale: 'en', slug: 'non-existent-slug' }),
        })
      ).rejects.toThrow('Not Found');
    });

    it('RunbookDetailPageRoute renders valid slugs in both English and Vietnamese', async () => {
      const allRunbooks = listRunbooks('en');
      expect(allRunbooks.length).toBe(10);

      const enResult = await RunbookDetailPageRoute({
        params: Promise.resolve({ locale: 'en', slug: 'quickstart' }),
      });
      expect(enResult).toBeDefined();

      const viResult = await RunbookDetailPageRoute({
        params: Promise.resolve({ locale: 'vi', slug: 'quickstart' }),
      });
      expect(viResult).toBeDefined();

      const numResult = await RunbookDetailPageRoute({
        params: Promise.resolve({ locale: 'en', slug: '01' }),
      });
      expect(numResult).toBeDefined();
    });
  });

  // =========================================================================
  // CHALLENGE 5: /api/admin/handover/verify Auth & Authorization Gate
  // =========================================================================
  describe('5. /api/admin/handover/verify Auth & Authorization Gate', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env = { ...originalEnv };
      process.env.CRON_SECRET = 'cron_secret_alpha_999';
      process.env.INTERNAL_API_SECRET = 'internal_secret_beta_888';
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('EMPIRICAL PROBE 5.1: Rejects unauthenticated GET request (missing secret, no cookies)', async () => {
      vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      );

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify');
      const res = await getVerifyRoute(req);

      expect(res.status).toBe(401);
      const json = await res.json() as Record<string, unknown>;
      expect(json.error).toBe('Unauthorized');
    });

    it('EMPIRICAL PROBE 5.2: Rejects non-admin session with HTTP 403 Forbidden', async () => {
      vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue(
        NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }),
      );

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify');
      const res = await getVerifyRoute(req);

      expect(res.status).toBe(403);
      const json = await res.json() as Record<string, unknown>;
      expect(json.error).toContain('Forbidden');
    });

    it('EMPIRICAL PROBE 5.3: Rejects invalid or forged Bearer token', async () => {
      vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      );

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
        headers: { Authorization: 'Bearer forged_hacker_token_123' },
      });
      const res = await getVerifyRoute(req);

      expect(res.status).toBe(401);
    });

    it('EMPIRICAL PROBE 5.4: Rejects empty or whitespace-only Bearer token', async () => {
      vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      );

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
        headers: { Authorization: 'Bearer   ' },
      });
      const res = await getVerifyRoute(req);

      expect(res.status).toBe(401);
    });

    it('EMPIRICAL PROBE 5.5: Prevents empty secret match when CRON_SECRET is unset in environment', async () => {
      delete process.env.CRON_SECRET;
      delete process.env.INTERNAL_API_SECRET;

      vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      );

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
        headers: { Authorization: 'Bearer ' },
      });
      const res = await getVerifyRoute(req);

      expect(res.status).toBe(401);
    });

    it('EMPIRICAL PROBE 5.6: Authenticates successfully with valid Bearer CRON_SECRET', async () => {
      const mockReport: VerificationRunReport = {
        runId: 'run_cron_auth_test',
        timestamp: new Date().toISOString(),
        durationMs: 25,
        overallVerdict: 'PASS',
        totalChecks: 11,
        passedCount: 11,
        failedCount: 0,
        warningCount: 0,
        deployedSha: 'abcdef123456',
        localSha: 'abcdef123456',
        shaMatched: true,
        checkpoints: [],
      };
      vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockResolvedValue(mockReport);

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
        headers: { Authorization: 'Bearer cron_secret_alpha_999' },
      });
      const res = await getVerifyRoute(req);

      expect(res.status).toBe(200);
      const json = await res.json() as VerificationRunReport;
      expect(json.runId).toBe('run_cron_auth_test');
      expect(json.overallVerdict).toBe('PASS');
    });

    it('EMPIRICAL PROBE 5.7: Authenticates successfully with valid Bearer INTERNAL_API_SECRET', async () => {
      const mockReport: VerificationRunReport = {
        runId: 'run_internal_auth_test',
        timestamp: new Date().toISOString(),
        durationMs: 20,
        overallVerdict: 'PASS',
        totalChecks: 11,
        passedCount: 11,
        failedCount: 0,
        warningCount: 0,
        deployedSha: 'abcdef123456',
        localSha: 'abcdef123456',
        shaMatched: true,
        checkpoints: [],
      };
      vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockResolvedValue(mockReport);

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
        headers: { Authorization: 'Bearer internal_secret_beta_888' },
      });
      const res = await getVerifyRoute(req);

      expect(res.status).toBe(200);
      const json = await res.json() as VerificationRunReport;
      expect(json.runId).toBe('run_internal_auth_test');
    });

    it('EMPIRICAL PROBE 5.8: Authenticates successfully with valid admin session', async () => {
      vi.spyOn(requireAdminModule, 'requireAdminOrDeploy').mockResolvedValue({
        userId: 'usr_admin_authorized',
        isDeployToken: false,
      });

      const mockReport: VerificationRunReport = {
        runId: 'run_admin_session_test',
        timestamp: new Date().toISOString(),
        durationMs: 30,
        overallVerdict: 'PASS',
        totalChecks: 11,
        passedCount: 11,
        failedCount: 0,
        warningCount: 0,
        deployedSha: 'abcdef123456',
        localSha: 'abcdef123456',
        shaMatched: true,
        checkpoints: [],
      };
      vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockResolvedValue(mockReport);

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify');
      const res = await getVerifyRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('X-Handover-Verdict')).toBe('PASS');
    });
  });

  // =========================================================================
  // CHALLENGE 6: Partial Check Failures & Exception Resilience
  // =========================================================================
  describe('6. Partial Check Failures & Exception Resilience', () => {
    beforeEach(() => {
      process.env.CRON_SECRET = 'cron_secret_resilience_test';
    });

    it('EMPIRICAL PROBE 6.1: Gracefully returns diagnostic report with FAIL status without crashing on partial check failures', async () => {
      const partialFailReport: VerificationRunReport = {
        runId: 'run_partial_fail_01',
        timestamp: new Date().toISOString(),
        durationMs: 120,
        overallVerdict: 'FAIL',
        totalChecks: 11,
        passedCount: 8,
        failedCount: 2,
        warningCount: 1,
        deployedSha: 'deploy_sha_01',
        localSha: 'deploy_sha_01',
        shaMatched: true,
        checkpoints: [
          {
            checkpointId: 'edge_responsiveness',
            name: 'Edge Responsiveness Probe',
            nameVi: 'Kiểm Tra Máy Chủ Edge',
            category: 'edge',
            status: 'PASS',
            latencyMs: 15,
            details: 'Edge OK',
          },
          {
            checkpointId: 'd1_crud_consistency',
            name: 'D1 CRUD Consistency',
            nameVi: 'Nhất Quán Đọc Ghi D1',
            category: 'database',
            status: 'FAIL',
            latencyMs: 80,
            details: 'D1 connection timed out',
            error: 'Database timeout',
          },
          {
            checkpointId: 'r2_video_bucket',
            name: 'R2 Video Bucket',
            nameVi: 'Kho Lưu Trữ Video R2',
            category: 'storage',
            status: 'FAIL',
            latencyMs: 10,
            details: 'Missing R2 bindings',
            error: 'VIDEO_BUCKET unbound',
          },
          {
            checkpointId: 'notifications_telegram',
            name: 'Telegram Bot Probe',
            nameVi: 'Bot Cảnh Báo Telegram',
            category: 'notifications',
            status: 'WARN',
            latencyMs: 5,
            details: 'TELEGRAM_BOT_TOKEN unconfigured',
          },
        ],
      };

      vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockResolvedValue(partialFailReport);

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
        headers: { Authorization: 'Bearer cron_secret_resilience_test' },
      });
      const res = await getVerifyRoute(req);

      // Must return HTTP 200 with diagnostics, NOT an unhandled 500 crash
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Handover-Verdict')).toBe('FAIL');
      expect(res.headers.get('X-Checks-Passed')).toBe('8/11');

      const json = await res.json() as VerificationRunReport;
      expect(json.overallVerdict).toBe('FAIL');
      expect(json.failedCount).toBe(2);
      expect(json.warningCount).toBe(1);
      expect(json.passedCount).toBe(8);
      expect(json.checkpoints.find(c => c.checkpointId === 'd1_crud_consistency')?.status).toBe('FAIL');
    });

    it('EMPIRICAL PROBE 6.2: POST /api/admin/handover/verify handles malformed non-JSON body gracefully', async () => {
      const mockReport: VerificationRunReport = {
        runId: 'run_malformed_body_test',
        timestamp: new Date().toISOString(),
        durationMs: 15,
        overallVerdict: 'PASS',
        totalChecks: 11,
        passedCount: 11,
        failedCount: 0,
        warningCount: 0,
        deployedSha: 'test_sha',
        localSha: 'test_sha',
        shaMatched: true,
        checkpoints: [],
      };

      vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockResolvedValue(mockReport);

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer cron_secret_resilience_test',
          'Content-Type': 'application/json',
        },
        body: 'NOT_VALID_JSON{:::broken',
      });

      const res = await postVerifyRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json() as VerificationRunReport;
      expect(json.runId).toBe('run_malformed_body_test');
    });

    it('EMPIRICAL PROBE 6.3: Clamps extreme timeoutMs parameter to maximum allowed 10000ms', async () => {
      const execSpy = vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockResolvedValue({
        runId: 'run_timeout_clamp_test',
        timestamp: new Date().toISOString(),
        durationMs: 10,
        overallVerdict: 'PASS',
        totalChecks: 11,
        passedCount: 11,
        failedCount: 0,
        warningCount: 0,
        deployedSha: 'test_sha',
        localSha: 'test_sha',
        shaMatched: true,
        checkpoints: [],
      });

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify?timeoutMs=999999999', {
        headers: { Authorization: 'Bearer cron_secret_resilience_test' },
      });

      await getVerifyRoute(req);

      expect(execSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 10000,
        }),
      );
    });

    it('EMPIRICAL PROBE 6.4: Catches unexpected unhandled runner exception and returns HTTP 500 JSON without process termination', async () => {
      vi.spyOn(orchestratorModule, 'executeVerificationSuite').mockRejectedValue(
        new Error('Fatal unhandled runtime segmentation fault simulation'),
      );

      const req = new NextRequest('http://localhost:3000/api/admin/handover/verify', {
        headers: { Authorization: 'Bearer cron_secret_resilience_test' },
      });

      const res = await getVerifyRoute(req);
      expect(res.status).toBe(500);
      const json = await res.json() as Record<string, unknown>;
      expect(json.error).toBe('Verification runner failed');
      expect(json.message).toContain('Fatal unhandled runtime segmentation fault simulation');
    });
  });
});

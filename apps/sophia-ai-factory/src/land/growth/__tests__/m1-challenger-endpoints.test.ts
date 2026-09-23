/**
 * Empirical Adversarial Challenge Suite: Scheduled Cron & Admin Intervention Endpoints
 * Challenger 2 — Milestone 1 (R1 Anti-Churn Guardian)
 *
 * Covers:
 * 1. Unauthorized access & auth bypass on /api/cron/anti-churn-guardian (GET & POST)
 * 2. Unauthorized access & role enforcement on /api/admin/customer-intervention (GET & POST)
 * 3. Payload validation, boundary enforcement, and XSS/HTML injection on POST /api/admin/customer-intervention
 * 4. High-concurrency race condition and atomic balance integrity tests on addCredits
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { DatabaseSync } from 'node:sqlite';

// ---- Hoisted Mocks ----
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  scanAndDispatchWinBackTriggers: vi.fn(),
  executeFounderIntervention: vi.fn(),
  listAllCustomerHealthMetrics: vi.fn(),
  getRetentionSummaryStats: vi.fn(),
  getCustomerHealthMetrics: vi.fn(),
  sendEmail: vi.fn(),
  sendTelegramMessage: vi.fn(),
  startCronCheckIn: vi.fn(() => ({ id: 'cron-run-1' })),
  finishCronCheckIn: vi.fn(),
  failCronCheckIn: vi.fn(),
  getD1: vi.fn(),
  createServerClient: vi.fn(),
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/seed/auth/require-admin', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/seed/observability/cron-check-in', () => ({
  startCronCheckIn: mocks.startCronCheckIn,
  finishCronCheckIn: mocks.finishCronCheckIn,
  failCronCheckIn: mocks.failCronCheckIn,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: mocks.logger,
}));

vi.mock('@/tree/email/sender', () => ({
  sendEmail: mocks.sendEmail,
}));

vi.mock('@/tree/telegram/telegram-client', () => ({
  sendTelegramMessage: mocks.sendTelegramMessage,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.getD1,
  createServerClient: mocks.createServerClient,
}));

vi.mock('@/land/growth/customer-retention-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/land/growth/customer-retention-service')>();
  return {
    ...actual,
    scanAndDispatchWinBackTriggers: mocks.scanAndDispatchWinBackTriggers,
    executeFounderIntervention: mocks.executeFounderIntervention,
    listAllCustomerHealthMetrics: mocks.listAllCustomerHealthMetrics,
    getRetentionSummaryStats: mocks.getRetentionSummaryStats,
    getCustomerHealthMetrics: mocks.getCustomerHealthMetrics,
  };
});

// Import route handlers under test
import { GET as cronGET, POST as cronPOST } from '@/app/api/cron/anti-churn-guardian/route';
import { GET as adminGET, POST as adminPOST } from '@/app/api/admin/customer-intervention/route';
import { addCredits } from '@/tree/mcu/credits-repo';

// ---- Test Helpers ----

function createCronRequest(options?: {
  method?: 'GET' | 'POST';
  authHeader?: string;
  xCronSecret?: string;
  queryParams?: Record<string, string>;
}): NextRequest {
  const url = new URL('https://sophia.agencyos.network/api/cron/anti-churn-guardian');
  if (options?.queryParams) {
    for (const [k, v] of Object.entries(options.queryParams)) {
      url.searchParams.set(k, v);
    }
  }

  const headers = new Headers();
  if (options?.authHeader !== undefined) {
    headers.set('authorization', options.authHeader);
  }
  if (options?.xCronSecret !== undefined) {
    headers.set('x-cron-secret', options.xCronSecret);
  }

  return new NextRequest(url.toString(), {
    method: options?.method || 'GET',
    headers,
  });
}

function createAdminRequest(options: {
  method: 'GET' | 'POST';
  queryParams?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}): NextRequest {
  const url = new URL('https://sophia.agencyos.network/api/admin/customer-intervention');
  if (options.queryParams) {
    for (const [k, v] of Object.entries(options.queryParams)) {
      url.searchParams.set(k, v);
    }
  }

  const headers = new Headers(options.headers || {});
  let bodyStr: string | undefined;
  if (options.body !== undefined) {
    headers.set('content-type', 'application/json');
    bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  return new NextRequest(url.toString(), {
    method: options.method,
    headers,
    body: bodyStr,
  });
}

const TEST_CRON_SECRET = 'correct-cron-super-secret-key-2026';
const ADMIN_USER = {
  id: 'usr-admin-1',
  email: 'founder@sophia.agencyos.network',
  name: 'Sophia Founder',
  role: 'admin',
};

describe('Milestone 1 Challenger 2: Scheduled Cron & Admin Intervention Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CRON_SECRET', TEST_CRON_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // =========================================================================
  // SUITE 1: Adversarial Authorization on /api/cron/anti-churn-guardian
  // =========================================================================
  describe('Suite 1: Scheduled Cron Endpoint Authorization Challenge', () => {
    it('1.1: rejects request with missing Authorization header (401)', async () => {
      const req = createCronRequest();
      const res = await cronGET(req);

      expect(res.status).toBe(401);
      const json = await res.json() as { error: string };
      expect(json.error).toMatch(/Unauthorized - Cron authentication required/i);
      expect(mocks.scanAndDispatchWinBackTriggers).not.toHaveBeenCalled();
    });

    it('1.2: rejects invalid Bearer token with 401', async () => {
      const req = createCronRequest({ authHeader: 'Bearer wrong-secret-token' });
      const res = await cronGET(req);

      expect(res.status).toBe(401);
      const json = await res.json() as { error: string };
      expect(json.error).toMatch(/Unauthorized - Cron authentication required/i);
      expect(mocks.scanAndDispatchWinBackTriggers).not.toHaveBeenCalled();
    });

    it('1.3: rejects empty or malformed Bearer tokens (401)', async () => {
      const emptyBearer = createCronRequest({ authHeader: 'Bearer ' });
      const bareBearer = createCronRequest({ authHeader: 'Bearer' });
      const basicAuth = createCronRequest({ authHeader: 'Basic dXNlcjpwYXNz' });

      const res1 = await cronGET(emptyBearer);
      const res2 = await cronGET(bareBearer);
      const res3 = await cronGET(basicAuth);

      expect(res1.status).toBe(401);
      expect(res2.status).toBe(401);
      expect(res3.status).toBe(401);
    });

    it('1.4: rejects legacy ?token= query parameter without Authorization header (401)', async () => {
      // Query param token was removed in security hardening
      const req = createCronRequest({ queryParams: { token: TEST_CRON_SECRET } });
      const res = await cronGET(req);

      expect(res.status).toBe(401);
      expect(mocks.scanAndDispatchWinBackTriggers).not.toHaveBeenCalled();
    });

    it('1.5: rejects partial / prefix match attempts (timingSafeEqual bounds)', async () => {
      // Attacker tries partial prefix or extended string
      const prefixReq = createCronRequest({ authHeader: `Bearer ${TEST_CRON_SECRET.slice(0, 10)}` });
      const extendedReq = createCronRequest({ authHeader: `Bearer ${TEST_CRON_SECRET}extra` });

      expect((await cronGET(prefixReq)).status).toBe(401);
      expect((await cronGET(extendedReq)).status).toBe(401);
    });

    it('1.6: fails closed when CRON_SECRET is empty or undefined in production', async () => {
      vi.stubEnv('CRON_SECRET', '');
      const req = createCronRequest({ authHeader: 'Bearer any-token' });
      const res = await cronGET(req);

      expect(res.status).toBe(401);
    });

    it('1.7: POST method enforces identical 401 authorization requirement', async () => {
      const unauthorizedPost = createCronRequest({ method: 'POST' });
      const res = await cronPOST(unauthorizedPost);

      expect(res.status).toBe(401);
      expect(mocks.scanAndDispatchWinBackTriggers).not.toHaveBeenCalled();
    });

    it('1.8: allows request with valid Bearer token and executes scan successfully (200)', async () => {
      mocks.scanAndDispatchWinBackTriggers.mockResolvedValueOnce({
        scanned: 15,
        atRisk: 3,
        dispatched: [
          { userId: 'u1', userEmail: 'u1@test.com', emailSent: true, telegramNotified: true },
        ],
      });

      const req = createCronRequest({ authHeader: `Bearer ${TEST_CRON_SECRET}` });
      const res = await cronGET(req);

      expect(res.status).toBe(200);
      const json = await res.json() as { ok: boolean; scanned: number; atRisk: number; dispatchedCount: number };
      expect(json.ok).toBe(true);
      expect(json.scanned).toBe(15);
      expect(json.atRisk).toBe(3);
      expect(json.dispatchedCount).toBe(1);
      expect(mocks.finishCronCheckIn).toHaveBeenCalled();
    });

    it('1.9: allows request with valid x-cron-secret header (200)', async () => {
      mocks.scanAndDispatchWinBackTriggers.mockResolvedValueOnce({
        scanned: 5,
        atRisk: 0,
        dispatched: [],
      });

      const req = createCronRequest({ xCronSecret: TEST_CRON_SECRET });
      const res = await cronGET(req);

      expect(res.status).toBe(200);
      const json = await res.json() as { ok: boolean; atRisk: number };
      expect(json.ok).toBe(true);
      expect(json.atRisk).toBe(0);
    });

    it('1.10: passes dryRun=true flag correctly to retention service', async () => {
      mocks.scanAndDispatchWinBackTriggers.mockResolvedValueOnce({
        scanned: 2,
        atRisk: 1,
        dispatched: [],
      });

      const req = createCronRequest({
        authHeader: `Bearer ${TEST_CRON_SECRET}`,
        queryParams: { dryRun: 'true' },
      });
      const res = await cronGET(req);

      expect(res.status).toBe(200);
      expect(mocks.scanAndDispatchWinBackTriggers).toHaveBeenCalledWith({ dryRun: true });
    });

    it('1.11: handles unhandled scanner exception gracefully with 500 status', async () => {
      mocks.scanAndDispatchWinBackTriggers.mockRejectedValueOnce(new Error('D1 Connection Timeout'));

      const req = createCronRequest({ authHeader: `Bearer ${TEST_CRON_SECRET}` });
      const res = await cronGET(req);

      expect(res.status).toBe(500);
      const json = await res.json() as { ok: boolean; error: string };
      expect(json.ok).toBe(false);
      expect(json.error).toBe('D1 Connection Timeout');
      expect(mocks.failCronCheckIn).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // SUITE 2: Adversarial Authorization on /api/admin/customer-intervention
  // =========================================================================
  describe('Suite 2: Admin Customer Intervention Endpoint Authorization Challenge', () => {
    it('2.1: rejects unauthenticated requests on GET with 401', async () => {
      mocks.requireAdmin.mockResolvedValueOnce(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      );

      const req = createAdminRequest({ method: 'GET' });
      const res = await adminGET(req);

      expect(res.status).toBe(401);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Unauthorized');
      expect(mocks.listAllCustomerHealthMetrics).not.toHaveBeenCalled();
    });

    it('2.2: rejects unauthenticated requests on POST with 401', async () => {
      mocks.requireAdmin.mockResolvedValueOnce(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      );

      const req = createAdminRequest({ method: 'POST', body: { userId: 'usr-1' } });
      const res = await adminPOST(req);

      expect(res.status).toBe(401);
      expect(mocks.executeFounderIntervention).not.toHaveBeenCalled();
    });

    it('2.3: rejects authenticated non-admin user on GET with 403 Forbidden', async () => {
      mocks.requireAdmin.mockResolvedValueOnce(
        NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }),
      );

      const req = createAdminRequest({ method: 'GET' });
      const res = await adminGET(req);

      expect(res.status).toBe(403);
      const json = await res.json() as { error: string };
      expect(json.error).toMatch(/Forbidden/i);
    });

    it('2.4: rejects authenticated non-admin user on POST with 403 Forbidden', async () => {
      mocks.requireAdmin.mockResolvedValueOnce(
        NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 }),
      );

      const req = createAdminRequest({ method: 'POST', body: { userId: 'usr-1' } });
      const res = await adminPOST(req);

      expect(res.status).toBe(403);
      expect(mocks.executeFounderIntervention).not.toHaveBeenCalled();
    });

    it('2.5: handles auth service failure on requireAdmin with 503', async () => {
      mocks.requireAdmin.mockResolvedValueOnce(
        NextResponse.json({ error: 'Authentication service temporarily unavailable' }, { status: 503 }),
      );

      const req = createAdminRequest({ method: 'GET' });
      const res = await adminGET(req);

      expect(res.status).toBe(503);
    });

    it('2.6: allows authenticated admin user on GET and returns summary stats and customers', async () => {
      mocks.requireAdmin.mockResolvedValueOnce({ user: ADMIN_USER });
      mocks.getRetentionSummaryStats.mockResolvedValueOnce({
        totalMonitored: 10,
        healthyCount: 7,
        warningCount: 2,
        criticalChurnCount: 1,
        averageHealthScore: 78,
      });
      mocks.listAllCustomerHealthMetrics.mockResolvedValueOnce([]);

      const req = createAdminRequest({ method: 'GET' });
      const res = await adminGET(req);

      expect(res.status).toBe(200);
      const json = await res.json() as { ok: boolean; summary: { totalMonitored: number } };
      expect(json.ok).toBe(true);
      expect(json.summary.totalMonitored).toBe(10);
    });
  });

  // =========================================================================
  // SUITE 3: Payload Validation & Credit Bounds on POST /api/admin/customer-intervention
  // =========================================================================
  describe('Suite 3: Payload Validation & Bounds on POST /api/admin/customer-intervention', () => {
    beforeEach(() => {
      mocks.requireAdmin.mockResolvedValue({ user: ADMIN_USER });
    });

    it('3.1: rejects negative bonus credits (-1, -500) with 400 Bad Request', async () => {
      const req1 = createAdminRequest({ method: 'POST', body: { userId: 'usr-1', bonusCredits: -1 } });
      const res1 = await adminPOST(req1);
      expect(res1.status).toBe(400);

      const json1 = await res1.json() as { ok: boolean; error: string; details: { bonusCredits?: { _errors: string[] } } };
      expect(json1.ok).toBe(false);
      expect(json1.error).toBe('Validation failed');
      expect(json1.details.bonusCredits?._errors.length).toBeGreaterThan(0);

      const req2 = createAdminRequest({ method: 'POST', body: { userId: 'usr-1', bonusCredits: -500 } });
      const res2 = await adminPOST(req2);
      expect(res2.status).toBe(400);

      expect(mocks.executeFounderIntervention).not.toHaveBeenCalled();
    });

    it('3.2: rejects non-integer / floating-point credits (100.5, 0.1) with 400 Bad Request', async () => {
      const reqFloat = createAdminRequest({ method: 'POST', body: { userId: 'usr-1', bonusCredits: 100.5 } });
      const resFloat = await adminPOST(reqFloat);

      expect(resFloat.status).toBe(400);
      const json = await resFloat.json() as { ok: boolean; details: { bonusCredits?: { _errors: string[] } } };
      expect(json.ok).toBe(false);
      expect(json.details.bonusCredits?._errors[0]).toMatch(/int/i);
    });

    it('3.3: enforces upper credit boundary: rejects > 50000 credits (50001, 1000000)', async () => {
      const reqOver = createAdminRequest({ method: 'POST', body: { userId: 'usr-1', bonusCredits: 50001 } });
      const resOver = await adminPOST(reqOver);

      expect(resOver.status).toBe(400);
      const json = await resOver.json() as { ok: boolean; details: { bonusCredits?: { _errors: string[] } } };
      expect(json.ok).toBe(false);
      expect(json.details.bonusCredits?._errors.length).toBeGreaterThan(0);

      // Max allowable 50000 should be accepted
      mocks.executeFounderIntervention.mockResolvedValueOnce({
        success: true,
        userId: 'usr-1',
        creditsAdded: 50000,
        emailSent: true,
        telegramNotified: true,
        message: 'Success',
      });

      const reqMax = createAdminRequest({ method: 'POST', body: { userId: 'usr-1', bonusCredits: 50000 } });
      const resMax = await adminPOST(reqMax);
      expect(resMax.status).toBe(200);
      expect(mocks.executeFounderIntervention).toHaveBeenCalledWith(
        expect.objectContaining({ bonusCredits: 50000 }),
      );
    });

    it('3.4: allows 0 bonus credits (message-only intervention)', async () => {
      mocks.executeFounderIntervention.mockResolvedValueOnce({
        success: true,
        userId: 'usr-1',
        creditsAdded: 0,
        emailSent: true,
        telegramNotified: true,
        message: 'Success',
      });

      const reqZero = createAdminRequest({ method: 'POST', body: { userId: 'usr-1', bonusCredits: 0 } });
      const resZero = await adminPOST(reqZero);

      expect(resZero.status).toBe(200);
      expect(mocks.executeFounderIntervention).toHaveBeenCalledWith(
        expect.objectContaining({ bonusCredits: 0 }),
      );
    });

    it('3.5: applies default bonusCredits = 500 when omitted from payload', async () => {
      mocks.executeFounderIntervention.mockResolvedValueOnce({
        success: true,
        userId: 'usr-1',
        creditsAdded: 500,
        emailSent: true,
        telegramNotified: true,
        message: 'Success',
      });

      const reqDefault = createAdminRequest({ method: 'POST', body: { userId: 'usr-1' } });
      const resDefault = await adminPOST(reqDefault);

      expect(resDefault.status).toBe(200);
      expect(mocks.executeFounderIntervention).toHaveBeenCalledWith(
        expect.objectContaining({ bonusCredits: 500 }),
      );
    });

    it('3.6: rejects empty string or missing userId with 400 Bad Request', async () => {
      const reqEmpty = createAdminRequest({ method: 'POST', body: { userId: '' } });
      const resEmpty = await adminPOST(reqEmpty);
      expect(resEmpty.status).toBe(400);

      const reqMissing = createAdminRequest({ method: 'POST', body: { bonusCredits: 500 } });
      const resMissing = await adminPOST(reqMissing);
      expect(resMissing.status).toBe(400);

      const reqNull = createAdminRequest({ method: 'POST', body: { userId: null } });
      const resNull = await adminPOST(reqNull);
      expect(resNull.status).toBe(400);

      const reqNumeric = createAdminRequest({ method: 'POST', body: { userId: 12345 } });
      const resNumeric = await adminPOST(reqNumeric);
      expect(resNumeric.status).toBe(400);
    });

    it('3.7: rejects customMessage exceeding 2000 characters with 400 Bad Request', async () => {
      const oversizedMsg = 'a'.repeat(2001);
      const reqOversized = createAdminRequest({
        method: 'POST',
        body: { userId: 'usr-1', customMessage: oversizedMsg },
      });
      const resOversized = await adminPOST(reqOversized);

      expect(resOversized.status).toBe(400);
      const json = await resOversized.json() as { ok: boolean; details: { customMessage?: { _errors: string[] } } };
      expect(json.details.customMessage?._errors.length).toBeGreaterThan(0);

      // Exactly 2000 chars should pass validation
      mocks.executeFounderIntervention.mockResolvedValueOnce({
        success: true,
        userId: 'usr-1',
        creditsAdded: 500,
        emailSent: true,
        telegramNotified: true,
      });

      const exactMsg = 'a'.repeat(2000);
      const reqExact = createAdminRequest({
        method: 'POST',
        body: { userId: 'usr-1', customMessage: exactMsg },
      });
      const resExact = await adminPOST(reqExact);
      expect(resExact.status).toBe(200);
    });

    it('3.8: returns 404 when target user does not exist', async () => {
      mocks.executeFounderIntervention.mockResolvedValueOnce({
        success: false,
        userId: 'usr-nonexistent',
        creditsAdded: 0,
        emailSent: false,
        telegramNotified: false,
        message: 'Customer not found',
        timestamp: new Date().toISOString(),
      });

      const req = createAdminRequest({ method: 'POST', body: { userId: 'usr-nonexistent' } });
      const res = await adminPOST(req);

      expect(res.status).toBe(404);
      const json = await res.json() as { ok: boolean; error: string };
      expect(json.ok).toBe(false);
      expect(json.error).toBe('Customer not found');
    });

    it('3.9: returns 500 on malformed non-JSON body payload', async () => {
      const req = createAdminRequest({ method: 'POST', body: '{"broken json' });
      const res = await adminPOST(req);

      expect(res.status).toBe(500);
      const json = await res.json() as { ok: boolean; error: string };
      expect(json.ok).toBe(false);
      expect(json.error).toMatch(/Intervention execution failed/i);
    });

    // =======================================================================
    // VULNERABILITY CHALLENGE: XSS & HTML INJECTION IN customMessage
    // =======================================================================
    it('3.10: EMPIRICAL VULNERABILITY PROOF: POST accepts raw HTML/XSS script in customMessage without sanitization', async () => {
      const xssPayload = '<script>alert("XSS")</script><img src="x" onerror="stealTokens()" />';

      // Schema accepts XSS payload because interventionSchema uses raw z.string().max(2000)
      mocks.executeFounderIntervention.mockResolvedValueOnce({
        success: true,
        userId: 'usr-target',
        creditsAdded: 500,
        emailSent: true,
        telegramNotified: true,
        message: 'Success',
      });

      const req = createAdminRequest({
        method: 'POST',
        body: {
          userId: 'usr-target',
          customMessage: xssPayload,
        },
      });

      const res = await adminPOST(req);
      expect(res.status).toBe(200);

      // Verify that unescaped XSS payload was forwarded directly into executeFounderIntervention
      expect(mocks.executeFounderIntervention).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'usr-target',
          customMessage: xssPayload,
        }),
      );
    });

    it('3.11: executeFounderIntervention sanitizes customMessage and escapes dangerous HTML/script tags in email HTML template', async () => {
      // Restore actual executeFounderIntervention implementation to observe email HTML generation
      const { executeFounderIntervention: realIntervention } = await vi.importActual<
        typeof import('@/land/growth/customer-retention-service')
      >('@/land/growth/customer-retention-service');

      // Mock D1 to provide user row so getCustomerHealthMetrics succeeds
      const mockD1 = {
        prepare: vi.fn((sql: string) => ({
          bind: vi.fn(() => ({
            first: vi.fn().mockImplementation(async () => {
              if (sql.includes('FROM "user"')) {
                return {
                  id: 'usr-victim',
                  email: 'victim@customer.com',
                  name: 'Victim User',
                  createdAt: '2026-01-01T00:00:00Z',
                };
              }
              return null;
            }),
            all: vi.fn().mockResolvedValue({ results: [] }),
            run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
          })),
        })),
      };
      mocks.getD1.mockResolvedValue(mockD1 as unknown as D1Database);
      mocks.createServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      });

      mocks.sendEmail.mockResolvedValue({ success: true, messageId: 'msg-1' });
      mocks.sendTelegramMessage.mockResolvedValue({ ok: true });

      const maliciousNote = '"><script>alert("PWNED")</script><b onmouseover="alert(1)">Click</b>';

      await realIntervention({
        userId: 'usr-victim',
        bonusCredits: 500,
        customMessage: maliciousNote,
        notifyEmail: true,
        notifyTelegram: false,
        actorUserId: 'usr-admin-1',
      });

      expect(mocks.sendEmail).toHaveBeenCalled();
      const emailArgs = mocks.sendEmail.mock.calls[0][0] as { to: string; html: string; subject: string };

      // VERIFY SANITIZATION: Dangerous script tags and unescaped HTML characters must be entity-escaped
      expect(emailArgs.html).not.toContain('<script>alert("PWNED")</script>');
      expect(emailArgs.html).toContain('&lt;script&gt;alert(&quot;PWNED&quot;)&lt;/script&gt;');
    });
  });

  // =========================================================================
  // SUITE 4: High-Concurrency Race Condition & Atomic Balance Integrity
  // =========================================================================
  describe('Suite 4: Concurrency & Atomic Balance Tests on addCredits', () => {
    let sqliteDb: InstanceType<typeof DatabaseSync>;

    beforeEach(() => {
      // Spin up real in-memory SQLite database using Node built-in node:sqlite
      sqliteDb = new DatabaseSync(':memory:');

      // Create exact schema
      sqliteDb.exec(`
        CREATE TABLE user_mcu_balance (
          user_id TEXT PRIMARY KEY,
          credits_remaining INTEGER NOT NULL DEFAULT 0,
          credits_total_purchased INTEGER NOT NULL DEFAULT 0,
          credits_total_used INTEGER NOT NULL DEFAULT 0,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE mcu_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          delta INTEGER NOT NULL,
          reason TEXT NOT NULL,
          mission_id TEXT,
          metadata TEXT,
          created_at INTEGER DEFAULT (strftime('%s','now'))
        );
      `);
    });

    afterEach(() => {
      (sqliteDb as unknown as { close?: () => void })?.close?.();
    });

    it('4.1: EMPIRICAL PROOF: 25 concurrent addCredits operations are atomic with zero lost updates in SQLite', async () => {
      // Implement Cloudflare D1 interface over real SQLite DatabaseSync
      const mockD1 = {
        prepare: (sql: string) => {
          const stmt = sqliteDb.prepare(sql);
          return {
            bind: (...params: unknown[]) => ({
              run: async () => {
                // Introduce microtask tick to interleave async executions
                await new Promise((r) => setImmediate(r));
                const info = stmt.run(...params as (number | string | bigint | Buffer | null)[]);
                return { meta: { changes: info.changes } };
              },
              all: async () => {
                await new Promise((r) => setImmediate(r));
                return { results: stmt.all(...params as (number | string | bigint | Buffer | null)[]) };
              },
              first: async () => {
                await new Promise((r) => setImmediate(r));
                return stmt.get(...params as (number | string | bigint | Buffer | null)[]);
              },
            }),
          };
        },
      };

      mocks.getD1.mockResolvedValue(mockD1 as unknown as D1Database);

      const targetUserId = 'usr-concurrent-test';
      const NUM_CONCURRENT_OPS = 25;
      const CREDITS_PER_OP = 200;
      const EXPECTED_TOTAL = NUM_CONCURRENT_OPS * CREDITS_PER_OP; // 5000 MCU

      // Concurrently fire 25 addCredits operations
      const promises = Array.from({ length: NUM_CONCURRENT_OPS }, (_, i) =>
        addCredits(targetUserId, CREDITS_PER_OP, `CONCURRENT_BONUS_${i}`, { index: i }),
      );

      const results = await Promise.all(promises);

      // 1. Every operation resolved true
      expect(results.every((r) => r === true)).toBe(true);

      // 2. Query final user_mcu_balance row from SQLite
      const balanceRow = sqliteDb
        .prepare('SELECT credits_remaining, credits_total_purchased FROM user_mcu_balance WHERE user_id = ?')
        .get(targetUserId) as { credits_remaining: number; credits_total_purchased: number };

      expect(balanceRow).toBeDefined();
      expect(balanceRow.credits_remaining).toBe(EXPECTED_TOTAL);
      expect(balanceRow.credits_total_purchased).toBe(EXPECTED_TOTAL);

      // 3. Query mcu_transactions ledger count and sum
      const txRows = sqliteDb
        .prepare('SELECT COUNT(*) as count, SUM(delta) as total_delta FROM mcu_transactions WHERE user_id = ?')
        .get(targetUserId) as { count: number; total_delta: number };

      expect(txRows.count).toBe(NUM_CONCURRENT_OPS);
      expect(txRows.total_delta).toBe(EXPECTED_TOTAL);
    });

    it('4.2: addCredits gracefully ignores non-positive credit amounts (0, negative)', async () => {
      const mockD1 = {
        prepare: vi.fn(),
      };
      mocks.getD1.mockResolvedValue(mockD1 as unknown as D1Database);

      const resZero = await addCredits('usr-1', 0, 'ZERO_CREDIT');
      const resNeg = await addCredits('usr-1', -100, 'NEGATIVE_CREDIT');

      expect(resZero).toBe(true);
      expect(resNeg).toBe(true);
      expect(mockD1.prepare).not.toHaveBeenCalled();
    });
  });
});

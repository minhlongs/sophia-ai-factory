/**
 * Adversarial & security regression suite for BYOK and Setup Wizard rate limiting.
 *
 * Covers:
 * - Verify / Save / Replace / Delete budget isolation and enforcement
 * - Independent users and organizations (same IP vs. multi-IP account rotation)
 * - IP-based abuse & header-spoof resistance (cf-connecting-ip precedence, x-api-key rotation blocked)
 * - Concurrent burst requests (exact cap under Promise.all)
 * - Repeated invalid keys (422s still consume probe budget; upstream fetch stops once capped)
 * - HTTP 429 standard headers (Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
 * - Authentication (401 before rate-limit consumption) and CSRF (403 on mutations without token)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  setUserApiKey: vi.fn(),
  clearUserApiKey: vi.fn(),
  listUserApiKeyProviders: vi.fn(),
  lookupUserApiKey: vi.fn(),
  probeProviderApiKey: vi.fn(),
  buildReceiptPayload: vi.fn(),
  getUserCredential: vi.fn(),
  setUserCredential: vi.fn(),
  registerHeyGenWebhook: vi.fn(),
  sendResendTestEmail: vi.fn(),
  track: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  setUserApiKey: mocks.setUserApiKey,
  clearUserApiKey: mocks.clearUserApiKey,
  listUserApiKeyProviders: mocks.listUserApiKeyProviders,
  lookupUserApiKey: mocks.lookupUserApiKey,
}));

vi.mock('@/tree/byok/provider-probe', () => ({
  probeProviderApiKey: mocks.probeProviderApiKey,
}));

vi.mock('@/tree/byok/receipt-payload-builder', () => ({
  buildReceiptPayload: mocks.buildReceiptPayload,
}));

vi.mock('@/tree/credentials/user-credentials-repo', () => ({
  getUserCredential: mocks.getUserCredential,
  setUserCredential: mocks.setUserCredential,
}));

vi.mock('@/land/heygen/webhook-registrar', () => ({
  registerHeyGenWebhook: mocks.registerHeyGenWebhook,
}));

vi.mock('@/tree/signals/track', () => ({
  track: mocks.track,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { globalRateLimiter, getClientIpIdentifier } from '@/forest/middleware/rate-limiter';
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  csrfForbiddenResponse,
  generateCsrfToken,
  requiresCsrfCheck,
  verifyCsrfToken,
} from '@/seed/security/csrf';
import { GET as byokGet, POST as byokPost, DELETE as byokDelete } from '@/app/api/user/byok/route';
import { POST as byokTestPost } from '@/app/api/user/byok/test/route';
import { POST as validateKeyPost } from '@/app/api/setup-wizard/validate-key/route';
import { POST as testHeygenPost } from '@/app/api/setup-wizard/test-heygen/route';
import { POST as autoRegisterHeygenPost } from '@/app/api/setup-wizard/heygen/auto-register/route';

const VALID_OPENROUTER_KEY = 'sk-or-v1-abcdefghijklmnopqrstuvwxyz1234567890';
const REPLACEMENT_OPENROUTER_KEY = 'sk-or-v1-zyxwvutsrqponmlkjihgfedcba0987654321';

function assertStandard429Headers(res: Response, expectedLimit: number): void {
  expect(res.status).toBe(429);
  expect(res.headers.get('X-RateLimit-Limit')).toBe(String(expectedLimit));
  expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
  expect(Number(res.headers.get('X-RateLimit-Reset'))).toBeGreaterThan(Date.now() - 1_000);
  expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
}

describe('BYOK & Setup Wizard adversarial rate-limit security', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalRateLimiter.clear();
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-alpha', email: 'ceo@alpha.vn' });
    mocks.setUserApiKey.mockResolvedValue(undefined);
    mocks.clearUserApiKey.mockResolvedValue(undefined);
    mocks.listUserApiKeyProviders.mockResolvedValue(['openrouter']);
    mocks.buildReceiptPayload.mockResolvedValue({ payload: { provider: 'openrouter' } });
    mocks.lookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: VALID_OPENROUTER_KEY });
    mocks.probeProviderApiKey.mockResolvedValue({
      ok: true,
      valid: true,
      provider: 'openrouter',
      status: 'ACTIVE',
      httpStatus: 200,
      latencyMs: 12,
      maskedKey: '****...7890',
      message: 'Active',
      message_vi: 'Hoạt động',
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('enforces independent budgets across Verify, Save/Replace, and Delete for one user', async () => {
    // Exhaust DELETE (10/min) — Save/Replace (20/min) and Read (60/min) must remain available
    for (let i = 0; i < 10; i++) {
      const del = await byokDelete(
        new NextRequest('http://localhost/api/user/byok', {
          method: 'DELETE',
          body: JSON.stringify({ provider: 'openrouter' }),
        }),
      );
      expect(del.status).toBe(200);
    }
    const blockedDelete = await byokDelete(
      new NextRequest('http://localhost/api/user/byok', {
        method: 'DELETE',
        body: JSON.stringify({ provider: 'openrouter' }),
      }),
    );
    assertStandard429Headers(blockedDelete, 10);

    // Save + Replace still succeed while DELETE is exhausted
    const saveRes = await byokPost(
      new NextRequest('http://localhost/api/user/byok', {
        method: 'POST',
        body: JSON.stringify({ provider: 'openrouter', key: VALID_OPENROUTER_KEY }),
      }),
    );
    expect(saveRes.status).toBe(200);

    const replaceRes = await byokPost(
      new NextRequest('http://localhost/api/user/byok', {
        method: 'POST',
        body: JSON.stringify({ provider: 'openrouter', key: REPLACEMENT_OPENROUTER_KEY }),
      }),
    );
    expect(replaceRes.status).toBe(200);

    const listRes = await byokGet();
    expect(listRes.status).toBe(200);
  });

  it('isolates independent users/orgs while still capping single-user multi-IP rotation', async () => {
    // Org A user exhausts their 10/min validateLive probe budget across 10 distinct IPs
    for (let i = 0; i < 10; i++) {
      const res = await byokPost(
        new NextRequest('http://localhost/api/user/byok', {
          method: 'POST',
          headers: { 'cf-connecting-ip': `198.51.100.${i + 1}` },
          body: JSON.stringify({
            provider: 'openrouter',
            key: VALID_OPENROUTER_KEY,
            validateLive: true,
          }),
        }),
      );
      expect(res.status).toBe(200);
    }

    // 11th probe from a fresh IP for the SAME user is blocked by the user-scoped probe limiter
    const rotatedIpAttempt = await byokPost(
      new NextRequest('http://localhost/api/user/byok', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '198.51.100.250' },
        body: JSON.stringify({
          provider: 'openrouter',
          key: VALID_OPENROUTER_KEY,
          validateLive: true,
        }),
      }),
    );
    assertStandard429Headers(rotatedIpAttempt, 10);

    // Meanwhile Org B user on their own IP is completely unaffected
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-bravo-org2', email: 'ceo@bravo.vn' });
    const orgBAttempt = await byokPost(
      new NextRequest('http://localhost/api/user/byok', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.88' },
        body: JSON.stringify({
          provider: 'openrouter',
          key: VALID_OPENROUTER_KEY,
          validateLive: true,
        }),
      }),
    );
    expect(orgBAttempt.status).toBe(200);
  });

  it('prevents IP-based multi-account rotation and x-api-key / x-forwarded-for header spoofing', async () => {
    const attackerEdgeIp = '203.0.113.66';

    // Direct helper check: cf-connecting-ip wins over spoofed x-forwarded-for and x-api-key
    const spoofedReq = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      headers: {
        'cf-connecting-ip': attackerEdgeIp,
        'x-forwarded-for': '10.0.0.99',
        'x-api-key': 'spoofed-random-header',
      },
    });
    expect(getClientIpIdentifier(spoofedReq)).toBe(`ip:${attackerEdgeIp}`);

    // Attacker rotates through 12 distinct user accounts from the same edge IP, spoofing x-api-key each time
    for (let i = 0; i < 12; i++) {
      mocks.getCurrentUser.mockResolvedValueOnce({ id: `sybil-user-${i}`, email: null });
      const res = await validateKeyPost(
        new NextRequest('http://localhost/api/setup-wizard/validate-key', {
          method: 'POST',
          headers: {
            'cf-connecting-ip': attackerEdgeIp,
            'x-forwarded-for': `10.10.10.${i}`,
            'x-api-key': `bypass-attempt-${i}`,
          },
          body: JSON.stringify({ provider: 'openrouter', api_key: VALID_OPENROUTER_KEY }),
        }),
      );
      expect(res.status).toBe(200);
    }

    // 13th request from that edge IP — even with a brand-new user and spoofed headers — hits 429
    mocks.getCurrentUser.mockResolvedValueOnce({ id: 'sybil-user-999', email: null });
    const blocked = await validateKeyPost(
      new NextRequest('http://localhost/api/setup-wizard/validate-key', {
        method: 'POST',
        headers: {
          'cf-connecting-ip': attackerEdgeIp,
          'x-forwarded-for': '8.8.8.8',
          'x-api-key': 'bypass-attempt-final',
        },
        body: JSON.stringify({ provider: 'openrouter', api_key: VALID_OPENROUTER_KEY }),
      }),
    );
    assertStandard429Headers(blocked, 12);
    expect(mocks.probeProviderApiKey).toHaveBeenCalledTimes(12);
  });

  it('caps concurrent burst requests on /api/user/byok/test and /api/setup-wizard/test-heygen', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);

    // Fire 16 concurrent /api/user/byok/test calls (cap = 10/min)
    const burst = await Promise.all(
      Array.from({ length: 16 }, () =>
        byokTestPost(
          new NextRequest('http://localhost/api/user/byok/test', {
            method: 'POST',
            headers: { 'cf-connecting-ip': '198.51.100.77' },
            body: JSON.stringify({ provider: 'openrouter' }),
          }),
        ),
      ),
    );

    const allowed = burst.filter((r) => r.status === 200);
    const throttled = burst.filter((r) => r.status === 429);
    expect(allowed).toHaveLength(10);
    expect(throttled).toHaveLength(6);
    for (const r of throttled) {
      assertStandard429Headers(r, 10);
    }
    expect(globalThis.fetch).toHaveBeenCalledTimes(10);

    // Also verify HeyGen probe (cap = 10/min) and webhook auto-register (cap = 5/min)
    const heygenBurst = await Promise.all(
      Array.from({ length: 13 }, () =>
        testHeygenPost(
          new NextRequest('http://localhost/api/setup-wizard/test-heygen', {
            method: 'POST',
            headers: { 'cf-connecting-ip': '198.51.100.78' },
            body: JSON.stringify({ api_key: 'hg_live_key_123456' }),
          }),
        ),
      ),
    );
    expect(heygenBurst.filter((r) => r.status === 200)).toHaveLength(10);
    expect(heygenBurst.filter((r) => r.status === 429)).toHaveLength(3);

    mocks.getUserCredential.mockResolvedValue('hg_stored_key');
    mocks.registerHeyGenWebhook.mockResolvedValue({ success: true, endpointId: 'ep_1' });
    const registerBurst = await Promise.all(
      Array.from({ length: 7 }, () =>
        autoRegisterHeygenPost(
          new NextRequest('http://localhost/api/setup-wizard/heygen/auto-register', {
            method: 'POST',
            headers: { 'cf-connecting-ip': '198.51.100.79' },
          }),
        ),
      ),
    );
    expect(registerBurst.filter((r) => r.status === 200)).toHaveLength(5);
    expect(registerBurst.filter((r) => r.status === 429)).toHaveLength(2);
  });

  it('counts repeated invalid keys against the probe budget and stops upstream probing at 429', async () => {
    mocks.probeProviderApiKey.mockResolvedValue({
      ok: false,
      valid: false,
      provider: 'openrouter',
      status: 'INVALID',
      httpStatus: 401,
      latencyMs: 20,
      maskedKey: '****...0000',
      message: 'Invalid API key credentials',
      message_vi: 'Khóa API không hợp lệ',
    });

    for (let i = 0; i < 12; i++) {
      const res = await validateKeyPost(
        new NextRequest('http://localhost/api/setup-wizard/validate-key', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '203.0.113.120' },
          body: JSON.stringify({ provider: 'openrouter', api_key: `sk-or-v1-bad-guess-${i}0000` }),
        }),
      );
      expect(res.status).toBe(422);
    }

    const thirteenth = await validateKeyPost(
      new NextRequest('http://localhost/api/setup-wizard/validate-key', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.120' },
        body: JSON.stringify({ provider: 'openrouter', api_key: 'sk-or-v1-bad-guess-final0000' }),
      }),
    );
    assertStandard429Headers(thirteenth, 12);
    // Upstream probe was NOT called on the 13th attempt — no unlimited provider-probing endpoint
    expect(mocks.probeProviderApiKey).toHaveBeenCalledTimes(12);
  });

  it('preserves 401 authentication guard and double-submit CSRF protection on BYOK & Setup Wizard mutations', async () => {
    // 1. Unauthenticated callers receive 401 and never consume an authenticated user's quota
    mocks.getCurrentUser.mockResolvedValueOnce(null);
    const unauthByok = await byokPost(
      new NextRequest('http://localhost/api/user/byok', {
        method: 'POST',
        body: JSON.stringify({ provider: 'openrouter', key: VALID_OPENROUTER_KEY }),
      }),
    );
    expect(unauthByok.status).toBe(401);

    mocks.getCurrentUser.mockResolvedValueOnce(null);
    const unauthProbe = await validateKeyPost(
      new NextRequest('http://localhost/api/setup-wizard/validate-key', {
        method: 'POST',
        body: JSON.stringify({ provider: 'openrouter', api_key: VALID_OPENROUTER_KEY }),
      }),
    );
    expect(unauthProbe.status).toBe(401);
    expect(mocks.probeProviderApiKey).not.toHaveBeenCalled();

    // 2. CSRF contract: all BYOK & Setup Wizard mutations require CSRF; GET does not
    expect(requiresCsrfCheck('/api/user/byok', 'GET')).toBe(false);
    expect(requiresCsrfCheck('/api/user/byok', 'POST')).toBe(true);
    expect(requiresCsrfCheck('/api/user/byok', 'DELETE')).toBe(true);
    expect(requiresCsrfCheck('/api/user/byok/test', 'POST')).toBe(true);
    expect(requiresCsrfCheck('/api/setup-wizard/validate-key', 'POST')).toBe(true);
    expect(requiresCsrfCheck('/api/setup-wizard/test-heygen', 'POST')).toBe(true);
    expect(requiresCsrfCheck('/api/setup-wizard/test-resend', 'POST')).toBe(true);

    const missingCsrfReq = new NextRequest('http://localhost/api/user/byok', { method: 'POST' });
    expect(verifyCsrfToken(missingCsrfReq)).toBe(false);
    expect(csrfForbiddenResponse().status).toBe(403);

    const token = generateCsrfToken();
    const validCsrfReq = new NextRequest('http://localhost/api/user/byok', {
      method: 'POST',
      headers: {
        cookie: `${CSRF_COOKIE_NAME}=${token}`,
        [CSRF_HEADER_NAME]: token,
      },
    });
    expect(verifyCsrfToken(validCsrfReq)).toBe(true);
  });
});

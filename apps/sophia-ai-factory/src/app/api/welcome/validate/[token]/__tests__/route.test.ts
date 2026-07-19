/**
 * Regression test: /api/welcome/validate/[token] POST handler
 * Locks in the magic-link → Set-Cookie name/attributes chain.
 * Zero network — all D1 + Better Auth + logger mocked.
 *
 * @see apps/sophia-ai-factory/src/app/api/welcome/validate/[token]/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks (must be hoisted before any import of the module under test) ---

vi.mock('@/tree/handover/handover-magic-link', () => ({
  validateMagicLinkToken: vi.fn(),
  consumeMagicLink: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(() => ({
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ email: 'e2e-test@sophia.local', name: 'E2E User' }),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    }),
  })),
}));

vi.mock('@/seed/auth/better-auth-server', () => ({
  getAuth: vi.fn(),
}));

vi.mock('@/tree/admin/audit-log', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  checkRateLimit: vi.fn().mockReturnValue(null), // null = not rate-limited, pass through
}));

// Import after mocks
import { POST } from '../route';
import { validateMagicLinkToken, consumeMagicLink } from '@/tree/handover/handover-magic-link';
import { getAuth } from '@/seed/auth/better-auth-server';
import { logger } from '@/seed/utils/logger-utility';
import { signCookieValue } from '@/seed/auth/sign-cookie-value';
import type { CustomerHandoverRow } from '@/tree/handover/handover-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-32-bytes-min-for-hmac';
const FAKE_SESSION_TOKEN = 'fake-session-tok-abc123';
const FAKE_EXPIRES_AT = new Date(Date.now() + 86_400_000);

/** Minimal valid handover row for tests */
const FAKE_HANDOVER: CustomerHandoverRow = {
  id: 'handover-id-1',
  customer_user_id: 'user-id-1',
  agency_name: 'Test Agency',
  agency_type: 'other',
  tier: 'BASIC',
  starter_sops: null,
  magic_link_token: 'test-token-abc',
  magic_link_expires_at: Math.floor(Date.now() / 1000) + 3600,
  created_by_admin_id: 'admin-id-1',
  created_at: Math.floor(Date.now() / 1000),
  welcome_email_sent_at: null,
  customer_first_login_at: null,
  customer_first_sop_install_at: null,
  customer_first_run_at: null,
  status: 'pending',
  source: 'manual',
  trigger_payment_id: null,
};

/** Build a minimal NextRequest for the route handler */
function buildRequest(token: string): NextRequest {
  return new NextRequest(`https://sophia.agencyos.network/api/welcome/validate/${token}`, {
    method: 'POST',
  });
}

/** Stub getAuth to return a working internalAdapter.createSession */
function mockCreateSession(
  result: { token: string; expiresAt: Date } | null,
): void {
  vi.mocked(getAuth).mockReturnValue({
    $context: Promise.resolve({
      internalAdapter: {
        createSession: vi.fn().mockResolvedValue(result),
      },
    }),
  } as unknown as ReturnType<typeof getAuth>);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/welcome/validate/[token]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    // Default: valid handover + working session
    vi.mocked(validateMagicLinkToken).mockResolvedValue(FAKE_HANDOVER);
    vi.mocked(consumeMagicLink).mockResolvedValue(true);
    mockCreateSession({ token: FAKE_SESSION_TOKEN, expiresAt: FAKE_EXPIRES_AT });
  });

  // =========================================================================
  // Test 1: Production — __Secure- prefix + Secure attribute
  // =========================================================================
  it('Test 1 (prod): mints __Secure-better-auth.session_token with HttpOnly; Secure; SameSite=Lax', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BETTER_AUTH_SECRET', TEST_SECRET);

    const req = buildRequest('test-token-abc');
    const response = await POST(req, { params: Promise.resolve({ token: 'test-token-abc' }) });

    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean; redirectUrl: string };
    expect(body.success).toBe(true);
    // Canonical onboarding URL — locale defaults to 'en' when no body sent
    expect(body.redirectUrl).toBe('/en/dashboard/onboarding');

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).not.toBeNull();
    expect(setCookie).toMatch(/^__Secure-better-auth\.session_token=/);

    // Parse attributes (order-independent)
    const parts = (setCookie ?? '').split('; ').map((s) => s.trim());
    expect(parts).toContain('HttpOnly');
    expect(parts).toContain('Secure');
    expect(parts).toContain('SameSite=Lax');
    expect(parts).toContain('Path=/');
    expect(parts.some((p) => p.startsWith('Expires='))).toBe(true);
  });

  // =========================================================================
  // Test 2: Development — no __Secure- prefix, no Secure attribute
  // =========================================================================
  it('Test 2 (dev): uses better-auth.session_token (no __Secure-) and omits Secure attribute', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('BETTER_AUTH_SECRET', TEST_SECRET);

    const req = buildRequest('test-token-abc');
    const response = await POST(req, { params: Promise.resolve({ token: 'test-token-abc' }) });

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).not.toBeNull();

    // Must NOT have __Secure- prefix
    expect(setCookie).not.toMatch(/^__Secure-/);
    expect(setCookie).toMatch(/^better-auth\.session_token=/);

    const parts = (setCookie ?? '').split('; ').map((s) => s.trim());
    expect(parts).not.toContain('Secure');
    expect(parts).toContain('HttpOnly');
    expect(parts).toContain('SameSite=Lax');
  });

  // =========================================================================
  // Test 3: Cookie value is HMAC-signed ${sessionToken}.${signature}
  // =========================================================================
  it('Test 3: cookie value is HMAC-signed (percent-encoded value.signature format)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BETTER_AUTH_SECRET', TEST_SECRET);

    const req = buildRequest('test-token-abc');
    const response = await POST(req, { params: Promise.resolve({ token: 'test-token-abc' }) });

    const setCookie = response.headers.get('set-cookie') ?? '';
    const rawCookiePart = setCookie.split('; ')[0] ?? '';
    const encodedValue = rawCookiePart.split('=').slice(1).join('=');
    const decodedValue = decodeURIComponent(encodedValue);

    // Signed format: "sessionToken.base64Signature"
    expect(decodedValue).toMatch(/^.+\..+$/);

    // Compute expected signed value and compare
    const expectedSigned = await signCookieValue(FAKE_SESSION_TOKEN, TEST_SECRET);
    expect(encodedValue).toBe(expectedSigned);
  });

  // =========================================================================
  // Test 4: Missing BETTER_AUTH_SECRET → no Set-Cookie + error logged
  // =========================================================================
  it('Test 4 (no secret): omits Set-Cookie header and logs error', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BETTER_AUTH_SECRET', '');
    // Also clear JWT_SECRET=REDACTED fallback
    vi.stubEnv('JWT_SECRET=REDACTED', '');

    const req = buildRequest('test-token-abc');
    const response = await POST(req, { params: Promise.resolve({ token: 'test-token-abc' }) });

    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeNull();

    expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
      expect.stringContaining('Missing BETTER_AUTH_SECRET'),
    );
  });

  // =========================================================================
  // Test 5: createSession returns null → no Set-Cookie + warn logged
  // =========================================================================
  it('Test 5 (null session): omits Set-Cookie and logs warn when createSession returns null', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('BETTER_AUTH_SECRET', TEST_SECRET);
    mockCreateSession(null); // override default mock

    const req = buildRequest('test-token-abc');
    const response = await POST(req, { params: Promise.resolve({ token: 'test-token-abc' }) });

    expect(response.status).toBe(200);
    const body = await response.json() as { success: boolean };
    expect(body.success).toBe(true);

    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toBeNull();

    expect(vi.mocked(logger.warn)).toHaveBeenCalledWith(
      expect.stringContaining('Session not created'),
      expect.any(Object),
    );
  });
});

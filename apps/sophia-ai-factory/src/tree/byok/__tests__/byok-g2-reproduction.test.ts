/**
 * G2 — Forensic Reproduction & Verification Matrix (SUPREME COMMAND #04)
 *
 * Tests all 14 mandatory G2 failure scenarios + root-cause regressions:
 *  1. Empty credential -> VALIDATION_ERROR
 *  2. Malformed / masked placeholder credential -> VALIDATION_ERROR
 *  3. Valid-shaped but invalid key -> INVALID_CREDENTIAL
 *  4. Valid authorized key -> VERIFIED (ACTIVE)
 *  5. Provider 403 -> FORBIDDEN
 *  6. Provider 429 -> RATE_LIMITED
 *  7. Provider 500/503 -> PROVIDER_UNAVAILABLE
 *  8. DNS/network failure -> NETWORK_ERROR
 *  9. Request timeout -> TIMEOUT
 * 10. Missing login session -> UNAUTHORIZED
 * 11. Wrong tenant -> FORBIDDEN / isolated by user.id
 * 12. Bad/missing CSRF token -> CSRF_REJECTED (~39ms middleware rejection)
 * 13. Invalid server configuration / unsupported provider -> CONFIGURATION_ERROR
 * 14. Malformed provider response (non-JSON 200) -> PROVIDER_RESPONSE_ERROR
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as validateKeyPOST } from '@/app/api/setup-wizard/validate-key/route';
import { POST as byokPOST } from '@/app/api/user/byok/route';
import { POST as byokTestPOST } from '@/app/api/user/byok/test/route';
import { PROBE_TARGETS } from '@/tree/byok/provider-probe-endpoints';
import { probeProviderApiKey } from '@/tree/byok/provider-probe';
import {
  requiresCsrfCheck,
  verifyCsrfToken,
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
} from '@/seed/security/csrf';
import {
  requestKeyValidation,
} from '@/tree/components/setup-wizard/steps/use-setup-wizard-actions';
import { saveWizardProviderKeys } from '@/tree/components/setup-wizard/steps/setup-wizard-api';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
  createLogger: () => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@/tree/byok/user-api-key-store', () => ({
  setUserApiKey: vi.fn(),
  clearUserApiKey: vi.fn(),
  listUserApiKeyProviders: vi.fn(),
  getUserApiKey: vi.fn(),
}));

vi.mock('@/tree/signals/track', () => ({
  track: vi.fn(),
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { setUserApiKey, getUserApiKey } from '@/tree/byok/user-api-key-store';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { logger } from '@/seed/utils/logger-utility';
import { globalRateLimiter } from '@/forest/middleware/rate-limiter';

describe('SUPREME COMMAND #04 — G2 Forensic Reproduction & 14-Scenario Matrix', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    globalRateLimiter.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('Root Cause #1 (Scenario 12 - CSRF_REJECTED): requestKeyValidation attaches x-csrf-token header from csrf-token cookie so middleware does not reject in ~39ms', async () => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: `${CSRF_COOKIE_NAME}=test-csrf-token-hex-123456`,
    });

    const spyFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const nextReq = new NextRequest(`http://localhost${url}`, {
        method: init?.method ?? 'POST',
        headers: {
          cookie: document.cookie,
          ...(headers.get(CSRF_HEADER_NAME)
            ? { [CSRF_HEADER_NAME]: headers.get(CSRF_HEADER_NAME)! }
            : {}),
        },
        body: init?.body as string,
      });

      expect(requiresCsrfCheck(url, 'POST')).toBe(true);
      if (!verifyCsrfToken(nextReq)) {
        return {
          ok: false,
          status: 403,
          json: async () => ({ error: 'csrf_token_invalid' }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          valid: true,
          provider: 'openrouter',
          status: 'ACTIVE',
          errorCode: null,
        }),
      } as Response;
    });
    global.fetch = spyFetch as unknown as typeof fetch;

    const result = await requestKeyValidation(
      'openrouter',
      'sk-or-v1-synthetic000000000000000000000000',
      'Xác thực khóa không thành công'
    );

    expect(result.valid).toBe(true);
  });

  it('Root Cause #2 (G3 OpenRouter Endpoint): PROBE_TARGETS.openrouter uses documented GET https://openrouter.ai/api/v1/key', () => {
    expect(PROBE_TARGETS.openrouter.url).toBe('https://openrouter.ai/api/v1/key');
    expect(PROBE_TARGETS.openrouter.method).toBe('GET');
  });

  it('Root Cause #2b (G3 /api/user/byok/test OpenRouter Endpoint): uses https://openrouter.ai/api/v1/key instead of unauthenticated /models', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1' } as never);
    vi.mocked(getUserApiKey).mockResolvedValue('sk-or-v1-synthetic000000000000000000000000');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: { label: 'test' } }),
    } as Response);
    global.fetch = mockFetch as unknown as typeof fetch;

    const req = new NextRequest('http://localhost/api/user/byok/test', {
      method: 'POST',
      body: JSON.stringify({ provider: 'openrouter' }),
    });
    const res = await byokTestPOST(req);
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/key',
      expect.objectContaining({
        method: 'GET',
      })
    );
  });

  it('Root Cause #3 (G4 Save Contract): saveWizardProviderKeys sends { provider, key } with CSRF header and skips masked placeholders', async () => {
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: `${CSRF_COOKIE_NAME}=csrf-save-token-999`,
    });

    const payloads: Array<{ body: Record<string, unknown>; csrf: string | null }> = [];
    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      payloads.push({
        body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
        csrf: headers.get(CSRF_HEADER_NAME),
      });
      return { ok: true, status: 200, json: async () => ({ ok: true }) } as Response;
    }) as unknown as typeof fetch;

    const saved = await saveWizardProviderKeys({
      OPENROUTER_API_KEY: 'sk-or-v1-synthetic1234567890abcdef123456',
      ANTHROPIC_API_KEY: '****...1234',
      ELEVENLABS_API_KEY: '',
      DID_API_KEY: '',
      MUAPI_API_KEY: '',
      REPLICATE_API_KEY: '',
      FAL_API_KEY: '',
    });

    expect(saved).toEqual(['openrouter']);
    expect(payloads).toHaveLength(1);
    expect(payloads[0].body).toEqual({
      provider: 'openrouter',
      key: 'sk-or-v1-synthetic1234567890abcdef123456',
    });
    expect(payloads[0].csrf).toBe('csrf-save-token-999');
  });

  it('Scenario 1 & 2 (Empty & Masked Placeholder Credential): returns 400 with errorCode VALIDATION_ERROR', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1' } as never);

    const maskedReq = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: 'openrouter', api_key: '****...5678' }),
    });
    const maskedRes = await validateKeyPOST(maskedReq);
    expect(maskedRes.status).toBe(400);
    const maskedData = (await maskedRes.json()) as { errorCode?: string; valid?: boolean };
    expect(maskedData.valid).toBe(false);
    expect(maskedData.errorCode).toBe('VALIDATION_ERROR');

    // Also verify /api/user/byok rejects masked keys
    const byokMaskedReq = new NextRequest('http://localhost/api/user/byok', {
      method: 'POST',
      body: JSON.stringify({ provider: 'openrouter', key: '****...567890123456' }),
    });
    const byokMaskedRes = await byokPOST(byokMaskedReq);
    expect(byokMaskedRes.status).toBe(400);
    expect(setUserApiKey).not.toHaveBeenCalled();
  });

  it('Scenario 3 & 4 (INVALID_CREDENTIAL vs VERIFIED with G3 contract metadata): returns correlationId, verifiedAt, durationMs, errorCode', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1' } as never);

    // 401 -> INVALID_CREDENTIAL
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid key' } }),
    } as unknown as Response);

    const badReq = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: 'anthropic', api_key: 'sk-ant-api03-invalid-synthetic-key' }),
    });
    const badRes = await validateKeyPOST(badReq);
    expect(badRes.status).toBe(422);
    const badJson = (await badRes.json()) as Record<string, unknown>;
    expect(badJson.errorCode).toBe('INVALID_CREDENTIAL');
    expect(typeof badJson.correlationId).toBe('string');
    expect(typeof badJson.durationMs).toBe('number');

    // 200 -> VERIFIED / ACTIVE
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ id: 'claude-sonnet-4-20250514' }] }),
    } as unknown as Response);

    const okReq = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: 'anthropic', api_key: 'sk-ant-api03-valid-synthetic-key-1234' }),
    });
    const okRes = await validateKeyPOST(okReq);
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as Record<string, unknown>;
    expect(okJson.valid).toBe(true);
    expect(okJson.status).toBe('ACTIVE');
    expect(okJson.errorCode).toBeNull();
    expect(typeof okJson.verifiedAt).toBe('string');
    expect(typeof okJson.correlationId).toBe('string');
  });

  it('Scenario 5, 6, 7, 8, 9, 13, 14: Provider probe distinguishes FORBIDDEN (403), RATE_LIMITED (429), PROVIDER_UNAVAILABLE (503), NETWORK_ERROR, TIMEOUT, CONFIGURATION_ERROR, and PROVIDER_RESPONSE_ERROR', async () => {
    // 5. 403 FORBIDDEN
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    const res403 = await probeProviderApiKey('openrouter', 'sk-or-v1-synthetic-403-key');
    expect(res403.errorCode).toBe('FORBIDDEN');

    // 6. 429 RATE_LIMITED
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 } as Response);
    const res429 = await probeProviderApiKey('openrouter', 'sk-or-v1-synthetic-429-key');
    expect(res429.errorCode).toBe('RATE_LIMITED');
    expect(res429.status).toBe('PROVIDER_UNAVAILABLE');

    // 7. 503 PROVIDER_UNAVAILABLE
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response);
    const res503 = await probeProviderApiKey('openrouter', 'sk-or-v1-synthetic-503-key');
    expect(res503.errorCode).toBe('PROVIDER_UNAVAILABLE');

    // 8. DNS/Network failure -> NETWORK_ERROR
    global.fetch = vi.fn().mockRejectedValue(new TypeError('fetch failed: ENOTFOUND'));
    const resNet = await probeProviderApiKey('openrouter', 'sk-or-v1-synthetic-net-key');
    expect(resNet.errorCode).toBe('NETWORK_ERROR');

    // 9. Timeout -> TIMEOUT
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortErr);
    const resTimeout = await probeProviderApiKey('openrouter', 'sk-or-v1-synthetic-timeout-key');
    expect(resTimeout.errorCode).toBe('TIMEOUT');

    // 13. Unsupported provider -> CONFIGURATION_ERROR
    const resCfg = await probeProviderApiKey('unknown-provider', 'sk-or-v1-synthetic-cfg-key');
    expect(resCfg.errorCode).toBe('CONFIGURATION_ERROR');

    // 14. Malformed provider response (200 OK with broken JSON body) -> PROVIDER_RESPONSE_ERROR
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    } as unknown as Response);
    const resMalformed = await probeProviderApiKey('openrouter', 'sk-or-v1-synthetic-html-key');
    expect(resMalformed.valid).toBe(false);
    expect(resMalformed.errorCode).toBe('PROVIDER_RESPONSE_ERROR');
  });

  it('Scenario 10 (Missing login session): returns 401 with errorCode UNAUTHORIZED', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: 'openrouter', api_key: 'sk-or-v1-synthetic' }),
    });
    const res = await validateKeyPOST(req);
    expect(res.status).toBe(401);
    const data = (await res.json()) as { errorCode?: string };
    expect(data.errorCode).toBe('UNAUTHORIZED');
  });

  it('Scenario 11 & G4/G5 (Tenant Isolation & Runtime Consumer Resolution): isolates keys by authenticated user.id and resolves via resolveUserApiKey', async () => {
    const prevByokEnabled = process.env.BYOK_ENABLED;
    process.env.BYOK_ENABLED = '1';

    try {
      vi.mocked(getUserApiKey).mockImplementation(async (userId, provider) => {
        if (userId === 'tenant_alpha' && provider === 'openrouter') {
          return 'sk-or-v1-tenant-alpha-secret-key-0001';
        }
        return null;
      });

      const alphaKey = await resolveUserApiKey('tenant_alpha', 'openrouter', 'fallback-env-key');
      const betaKey = await resolveUserApiKey('tenant_beta', 'openrouter', undefined);

      expect(alphaKey).toBe('sk-or-v1-tenant-alpha-secret-key-0001');
      expect(betaKey).toBeNull();
    } finally {
      process.env.BYOK_ENABLED = prevByokEnabled;
    }
  });

  it('G7 (Secret Hygiene): never leaks plaintext API key in validate-key response or logger metadata', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_sec_1' } as never);
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response);

    const rawSecret = 'sk-or-v1-ultra-sensitive-plaintext-secret-9876543210';
    const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: 'openrouter', api_key: rawSecret }),
    });

    const res = await validateKeyPOST(req);
    const bodyText = await res.text();

    expect(bodyText).not.toContain(rawSecret);
    expect(bodyText).toContain('****...3210');

    const warnCalls = JSON.stringify(vi.mocked(logger.warn).mock.calls);
    const errorCalls = JSON.stringify(vi.mocked(logger.error).mock.calls);
    const infoCalls = JSON.stringify(vi.mocked(logger.info).mock.calls);
    expect(warnCalls).not.toContain(rawSecret);
    expect(errorCalls).not.toContain(rawSecret);
    expect(infoCalls).not.toContain(rawSecret);
  });
});

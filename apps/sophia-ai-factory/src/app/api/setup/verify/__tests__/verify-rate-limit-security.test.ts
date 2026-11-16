/**
 * Security & Rate-Limiting Regression Suite for POST /api/setup/verify
 *
 * Verifies:
 * 1. Unconditional authentication (`401` even in zero-config environments).
 * 2. Zod input validation (`400` on missing key or unsupported service).
 * 3. `probeProviderApiKey` delegation — repeated `401` invalid keys NEVER trip
 *    the shared Worker `circuit-breaker` (`shouldAllowRequest` stays allowed).
 * 4. Per-user (`12/min`) and per-IP (`12/min`) `globalRateLimiter` `429` caps.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetCurrentUser = vi.fn();
const mockProbeProviderApiKey = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/tree/byok/provider-probe', () => ({
  probeProviderApiKey: (...args: unknown[]) => mockProbeProviderApiKey(...args),
}));

import { globalRateLimiter } from '@/forest/middleware/rate-limiter';
import { reset as resetCircuit, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { POST } from '../route';

function makeVerifyRequest(
  body: unknown,
  ip = '198.51.100.42',
): NextRequest {
  return new NextRequest('http://localhost/api/setup/verify', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/setup/verify security & rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalRateLimiter.clear();
    resetCircuit('openrouter');
    mockProbeProviderApiKey.mockResolvedValue({
      ok: true,
      valid: true,
      status: 'HEALTHY',
      provider: 'openrouter',
      maskedKey: '****1234',
      latencyMs: 38,
      httpStatus: 200,
      message: 'Verified',
      message_vi: 'Đã xác thực',
    });
  });

  it('rejects unauthenticated callers with 401 unconditionally', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const res = await POST(
      makeVerifyRequest({ service: 'openrouter', apiKey: 'sk-or-v1-test-1234567890' }),
    );

    expect(res.status).toBe(401);
    expect(mockProbeProviderApiKey).not.toHaveBeenCalled();
  });

  it('returns 400 on missing key or unsupported service', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_val_1', email: 'ceo@sophia.test' });

    const missingKey = await POST(makeVerifyRequest({ service: 'openrouter', apiKey: '   ' }));
    expect(missingKey.status).toBe(400);

    const unknownSvc = await POST(
      makeVerifyRequest({ service: 'unknown-provider', apiKey: 'sk-test-1234567890' }),
    );
    expect(unknownSvc.status).toBe(400);
    expect(mockProbeProviderApiKey).not.toHaveBeenCalled();
  });

  it('delegates to probeProviderApiKey without poisoning the shared circuit breaker on 401', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_cb_1', email: 'ceo@sophia.test' });
    mockProbeProviderApiKey.mockResolvedValue({
      ok: false,
      valid: false,
      status: 'INVALID_KEY',
      provider: 'openrouter',
      maskedKey: '****bad1',
      latencyMs: 25,
      httpStatus: 401,
      message: 'Unauthorized',
      message_vi: 'Khóa không hợp lệ',
    });

    for (let i = 0; i < 3; i += 1) {
      const res = await POST(
        makeVerifyRequest({ service: 'openrouter', apiKey: 'sk-or-v1-invalid-bad1' }),
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { valid: boolean; status: string };
      expect(json.valid).toBe(false);
      expect(json.status).toBe('INVALID_KEY');
    }

    expect(shouldAllowRequest('openrouter')).toBe(true);
  });

  it('enforces 12 req/min per-user cap across rotating IPs and returns 429', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'usr_flood_1', email: 'flood@sophia.test' });

    for (let i = 0; i < 12; i += 1) {
      const res = await POST(
        makeVerifyRequest(
          { service: 'openrouter', apiKey: 'sk-or-v1-valid-1234' },
          `198.51.100.${10 + i}`,
        ),
      );
      expect(res.status).toBe(200);
    }

    const blocked = await POST(
      makeVerifyRequest({ service: 'openrouter', apiKey: 'sk-or-v1-valid-1234' }, '198.51.100.99'),
    );
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBeTruthy();
  });

  it('enforces 12 req/min per-IP cap across rotating accounts and returns 429', async () => {
    const sharedIp = '203.0.113.88';
    for (let i = 0; i < 12; i += 1) {
      mockGetCurrentUser.mockResolvedValueOnce({ id: `usr_ip_${i}`, email: `u${i}@sophia.test` });
      const res = await POST(
        makeVerifyRequest({ service: 'elevenlabs', key: 'xi-test-key-1234' }, sharedIp),
      );
      expect(res.status).toBe(200);
    }

    mockGetCurrentUser.mockResolvedValueOnce({ id: 'usr_ip_13', email: 'u13@sophia.test' });
    const blocked = await POST(
      makeVerifyRequest({ service: 'elevenlabs', key: 'xi-test-key-1234' }, sharedIp),
    );
    expect(blocked.status).toBe(429);
  });
});

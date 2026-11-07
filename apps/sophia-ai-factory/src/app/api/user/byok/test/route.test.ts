import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  lookupUserApiKey: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));
vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: mocks.lookupUserApiKey,
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

import { globalRateLimiter } from '@/forest/middleware/rate-limiter';
import { POST } from './route';

function request(): NextRequest {
  return new NextRequest('http://localhost/api/user/byok/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'openrouter' }),
  });
}

describe('POST /api/user/byok/test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    globalRateLimiter.clear();
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
  });

  it('returns 404 only when the key is not configured', async () => {
    mocks.lookupUserApiKey.mockResolvedValue({ status: 'NOT_CONFIGURED' });

    const response = await POST(request());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('probes the provider with the decrypted key when it loads', async () => {
    mocks.lookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: 'sk-or-valid-key' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));

    const response = await POST(request());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, status: 200 });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toBe('https://openrouter.ai/api/v1/models');
    expect(init.headers.Authorization).toBe('Bearer sk-or-valid-key');
  });

  it.each(['STORE_UNAVAILABLE', 'DECRYPT_FAILED', 'KEY_VERSION_UNSUPPORTED'])(
    'returns 503 and does not call the provider for %s',
    async (status) => {
      mocks.lookupUserApiKey.mockResolvedValue({ status });

      const response = await POST(request());

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({ ok: false, code: status });
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
  );
});

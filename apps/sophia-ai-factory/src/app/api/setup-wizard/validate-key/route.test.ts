import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { getCurrentUser } from '@/seed/auth/better-auth-session';

interface ValidateKeyResponse {
  ok?: boolean;
  valid?: boolean;
  status?: string;
  maskedKey?: string;
  message?: string;
  message_vi?: string;
}

describe('POST /api/setup-wizard/validate-key', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns 401 if user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: 'openrouter', api_key: 'sk-or-v1-test' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = (await res.json()) as ValidateKeyResponse;
    expect(data.ok).toBe(false);
    expect(data.valid).toBe(false);
  });

  it('returns 400 on invalid body payload', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1', email: null } as never);

    const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: '' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as ValidateKeyResponse;
    expect(data.valid).toBe(false);
  });

  it('returns 400 for unsupported provider', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1', email: null } as never);

    const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: 'unsupported-provider', api_key: 'test-key-1234' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as ValidateKeyResponse;
    expect(data.status).toBe('UNKNOWN');
    expect(data.maskedKey).toBe('****...1234');
  });

  it('returns 200 and ACTIVE status when provider probe succeeds', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1', email: null } as never);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as Response);

    const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: 'fal-ai', api_key: 'key-fal-abcdef5678' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as ValidateKeyResponse;
    expect(data.ok).toBe(true);
    expect(data.valid).toBe(true);
    expect(data.status).toBe('ACTIVE');
    expect(data.maskedKey).toBe('****...5678');
  });

  it('returns 422 and INVALID status when provider returns 401 Unauthorized', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1', email: null } as never);
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    } as Response);

    const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: 'openrouter', api_key: 'sk-bad-key-9999' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = (await res.json()) as ValidateKeyResponse;
    expect(data.ok).toBe(false);
    expect(data.valid).toBe(false);
    expect(data.status).toBe('INVALID');
    expect(data.maskedKey).toBe('****...9999');
  });

  it('returns 502 and PROVIDER_UNAVAILABLE on fetch network error / timeout', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: 'user_1', email: null } as never);
    global.fetch = vi.fn().mockRejectedValue(new Error('connection timeout'));

    const req = new NextRequest('http://localhost/api/setup-wizard/validate-key', {
      method: 'POST',
      body: JSON.stringify({ provider: 'elevenlabs', api_key: 'xi-api-key-8888' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(502);
    const data = (await res.json()) as ValidateKeyResponse;
    expect(data.ok).toBe(false);
    expect(data.valid).toBe(false);
    expect(data.status).toBe('PROVIDER_UNAVAILABLE');
    expect(data.maskedKey).toBe('****...8888');
  });
});

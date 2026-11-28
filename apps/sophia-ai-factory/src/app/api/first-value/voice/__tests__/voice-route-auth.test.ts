import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockGetCurrentUser = vi.fn();
const mockVerifyCsrfToken = vi.fn();
const mockLookupUserApiKey = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/seed/security/csrf', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/seed/security/csrf')>();
  return {
    ...actual,
    verifyCsrfToken: (req: NextRequest) => mockVerifyCsrfToken(req),
  };
});

vi.mock('@/tree/byok/user-api-key-store', () => ({
  lookupUserApiKey: (...args: unknown[]) => mockLookupUserApiKey(...args),
}));

import { POST, resetVoiceRouteGuardsForTests } from '../route';

describe('Wave C.4.1 G4+G5: /api/first-value/voice authorization, CSRF, BYOK & provider truth', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    resetVoiceRouteGuardsForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects unauthenticated requests with 401 and invalid CSRF with 403', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const req1 = new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ text: 'Xin chào Sophia AI Factory' }),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(401);

    mockGetCurrentUser.mockResolvedValueOnce({ id: 'u-voice-1', email: 'v@example.test' });
    mockVerifyCsrfToken.mockReturnValueOnce(false);
    const req2 = new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ text: 'Xin chào Sophia AI Factory' }),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(403);
  });

  it('requires customer BYOK key (422), enforces rate limit (429), and returns truthful OpenRouter BYOK headers', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'u-voice-2', email: 'v@example.test' });
    mockVerifyCsrfToken.mockReturnValue(true);
    mockLookupUserApiKey.mockResolvedValueOnce({ status: 'NOT_FOUND' });

    const reqNoKey = new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ text: 'Xin chào Sophia AI Factory' }),
    });
    const resNoKey = await POST(reqNoKey);
    expect(resNoKey.status).toBe(422);

    mockLookupUserApiKey.mockResolvedValue({ status: 'FOUND', key: 'sk-or-v1-test-key-123456' });
    globalThis.fetch = vi.fn(async () => new Response(new Uint8Array([0x49, 0x44, 0x33, 0x03]), { status: 200 })) as unknown as typeof fetch;

    const reqOk = new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
      method: 'POST',
      body: JSON.stringify({ text: 'Xin chào Sophia AI Factory', voice: 'nova' }),
    });
    const resOk = await POST(reqOk);
    expect(resOk.status).toBe(200);
    expect(resOk.headers.get('X-Sophia-Tts-Provider')).toBe('openrouter-byok');
    expect(resOk.headers.get('X-Sophia-Tts-Model')).toBe('openai/gpt-4o-mini-tts');
    expect(resOk.headers.get('X-Sophia-Tts-Funding')).toBe('customer_byok');
    expect(resOk.headers.get('X-Sophia-Voice')).toBe('nova');

    // Exhaust 6/min rate limit
    for (let i = 0; i < 5; i += 1) {
      const r = await POST(
        new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
          method: 'POST',
          body: JSON.stringify({ text: 'Xin chào Sophia AI Factory', voice: 'nova' }),
        }),
      );
      expect(r.status).toBe(200);
    }
    const resRateLimited = await POST(
      new NextRequest('http://127.0.0.1:8788/api/first-value/voice', {
        method: 'POST',
        body: JSON.stringify({ text: 'Xin chào Sophia AI Factory', voice: 'nova' }),
      }),
    );
    expect(resRateLimited.status).toBe(429);
  });
});

/**
 * Tests for POST /api/videos/generate
 *
 * Endpoint deprecated 2026-05-17 (ADR 0007). The legacy `video_jobs` Inngest
 * chain was removed because its underlying D1 table was never applied to prod.
 * Endpoint now returns HTTP 410 Gone for authenticated callers; 401 for unauth
 * is preserved so the deprecation doesn't leak endpoint existence to probes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUserFromHeaders: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number; headers?: Record<string, string> }) => ({
      status: init?.status ?? 200,
      body: data,
    }),
  },
}));

import { getCurrentUserFromHeaders } from '@/seed/auth/better-auth-session';

const mockGetCurrentUser = getCurrentUserFromHeaders as ReturnType<typeof vi.fn>;

function makeRequest(): Request {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({}),
  } as unknown as Request;
}

describe('POST /api/videos/generate (deprecated, ADR 0007)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const { POST } = await import('../generate/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 410 Gone for authenticated callers with replacement hint', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
    const { POST } = await import('../generate/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(410);
    const body = res.body as unknown as { error: string; replacement: string; adr: string };
    expect(body.error).toBe('Endpoint deprecated.');
    expect(body.replacement).toBe('/api/missions');
    expect(body.adr).toBe('ADR-0007');
  });
});

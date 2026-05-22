/**
 * Tests for POST /api/videos/generate
 *
 * Endpoint deprecated 2026-05-17 (ADR 0007). The legacy `video_jobs` Inngest
 * chain was removed because its underlying D1 table was never applied to prod.
 * Endpoint now returns HTTP 410 Gone for authenticated callers; 401 for unauth
 * is preserved so the deprecation doesn't leak endpoint existence to probes.
 * Dual-auth (Bearer + cookie) via getCurrentUserOrOpenClaw (F4 fix).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OpenClawAuthResult, OpenClawAuthError } from '@/seed/auth/get-current-user-or-openclaw';

const mocks = vi.hoisted(() => ({
  getCurrentUserOrOpenClaw: vi.fn(),
  isAuthError: vi.fn(),
}));

vi.mock('@/seed/auth/get-current-user-or-openclaw', () => ({
  getCurrentUserOrOpenClaw: mocks.getCurrentUserOrOpenClaw,
  isAuthError: mocks.isAuthError,
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body: data,
    }),
  },
}));

function makeRequest(): Request {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve({}),
  } as unknown as Request;
}

function makeAuthError(status: 401 | 403): OpenClawAuthError {
  return {
    _type: 'auth_error',
    status,
    error: status === 401 ? 'Unauthorized' : 'Forbidden',
    toNextResponse() {
      return { status, body: { error: this.error } } as unknown as import('next/server').NextResponse;
    },
  };
}

function makeAuthOk(userId = 'u1', source: 'cookie' | 'openclaw' = 'cookie'): OpenClawAuthResult {
  return { _type: 'auth_ok', userId, source };
}

describe('POST /api/videos/generate (deprecated, ADR 0007) — dual-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthError.mockImplementation((r: { _type: string }) => r._type === 'auth_error');
  });

  it('returns 401 when not authenticated', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValue(makeAuthError(401));
    const { POST } = await import('../generate/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 410 Gone for authenticated cookie caller with replacement hint', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValue(makeAuthOk('user-1', 'cookie'));
    const { POST } = await import('../generate/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(410);
    const body = res.body as unknown as { error: string; replacement: string; adr: string };
    expect(body.error).toBe('Endpoint deprecated.');
    expect(body.replacement).toBe('/api/missions');
    expect(body.adr).toBe('ADR-0007');
  });

  it('returns 410 Gone for valid Bearer token (video:write scope)', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValue(makeAuthOk('user-1', 'openclaw'));
    const { POST } = await import('../generate/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(410);
  });

  it('returns 403 when helper returns 403 (scope missing)', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValue(makeAuthError(403));
    const { POST } = await import('../generate/route');
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });
});

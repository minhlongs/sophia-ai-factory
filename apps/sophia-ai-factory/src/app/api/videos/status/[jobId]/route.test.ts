/**
 * Route-level tests for GET /api/videos/status/[jobId] — dual-auth.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import type { OpenClawAuthResult, OpenClawAuthError } from '@/seed/auth/get-current-user-or-openclaw';

const mocks = vi.hoisted(() => ({
  getCurrentUserOrOpenClaw: vi.fn(),
  isAuthError: vi.fn(),
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/auth/get-current-user-or-openclaw', () => ({
  getCurrentUserOrOpenClaw: mocks.getCurrentUserOrOpenClaw,
  isAuthError: mocks.isAuthError,
}));
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: mocks.createServerClient,
}));
vi.mock('@/land/video/video-job-fsm', () => ({
  STATUS_PROGRESS: { queued: 0, processing: 50, done: 100, error: 0 },
}));

function makeReq() {
  return new Request('http://localhost/api/videos/status/job-abc');
}

function makeAuthError(status: 401 | 403): OpenClawAuthError {
  return {
    _type: 'auth_error',
    status,
    error: status === 401 ? 'Unauthorized' : 'Forbidden',
    toNextResponse: () => NextResponse.json({ error: status === 401 ? 'Unauthorized' : 'Forbidden' }, { status }),
  };
}

function makeAuthOk(userId = 'u1', source: 'cookie' | 'openclaw' = 'cookie'): OpenClawAuthResult {
  return { _type: 'auth_ok', userId, source };
}

describe('GET /api/videos/status/[jobId] — dual-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthError.mockImplementation((r: { _type: string }) => r._type === 'auth_error');

    const single = vi.fn().mockResolvedValue({
      data: { status: 'done', tenant_id: 'u1', error: null },
      error: null,
    });
    const eqChain = { eq: vi.fn().mockReturnThis(), single };
    const from = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(eqChain) });
    mocks.createServerClient.mockReturnValue({ from });
  });

  it('returns 401 when no auth', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthError(401));
    const { GET } = await import('./route');
    const res = await GET(makeReq(), { params: Promise.resolve({ jobId: 'job-abc' }) });
    expect(res.status).toBe(401);
  });

  it('returns 200 for valid cookie auth owning the job', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthOk('u1', 'cookie'));
    const { GET } = await import('./route');
    const res = await GET(makeReq(), { params: Promise.resolve({ jobId: 'job-abc' }) });
    expect(res.status).toBe(200);
  });

  it('returns 200 for valid Bearer + video:read scope', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthOk('u1', 'openclaw'));
    const { GET } = await import('./route');
    const res = await GET(makeReq(), { params: Promise.resolve({ jobId: 'job-abc' }) });
    expect(res.status).toBe(200);
  });

  it('returns 403 when helper returns 403 (scope missing)', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthError(403));
    const { GET } = await import('./route');
    const res = await GET(makeReq(), { params: Promise.resolve({ jobId: 'job-abc' }) });
    expect(res.status).toBe(403);
  });
});

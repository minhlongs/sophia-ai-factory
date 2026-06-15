/**
 * Route-level tests for GET /api/publish/status/[jobId] — dual-auth.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextResponse } from 'next/server';
import type { OpenClawAuthResult, OpenClawAuthError } from '@/seed/auth/get-current-user-or-openclaw';

const mocks = vi.hoisted(() => ({
  getCurrentUserOrOpenClaw: vi.fn(),
  isAuthError: vi.fn(),
  createServerClient: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));
vi.mock('@/seed/auth/get-current-user-or-openclaw', () => ({
  getCurrentUserOrOpenClaw: mocks.getCurrentUserOrOpenClaw,
  isAuthError: mocks.isAuthError,
}));
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: mocks.createServerClient,
}));

const MOCK_JOB = { id: 'job-123', tenant_id: 'u1', status: 'pending' };

function makeReq() {
  return new Request('http://localhost/api/publish/status/job-123');
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

describe('GET /api/publish/status/[jobId] — dual-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthError.mockImplementation((r: { _type: string }) => r._type === 'auth_error');

    const single = vi.fn().mockResolvedValue({ data: MOCK_JOB });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eqChain = { single, maybeSingle, eq: vi.fn().mockReturnThis() };
    const from = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(eqChain) });
    mocks.createServerClient.mockReturnValue({ from });
  });

  it('returns 401 when no auth', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthError(401));
    const { GET } = await import('./route');
    const res = await GET(makeReq(), { params: Promise.resolve({ jobId: 'job-123' }) });
    expect(res.status).toBe(401);
  });

  it('returns 200 for valid cookie auth owning the job', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthOk('u1', 'cookie'));
    const { GET } = await import('./route');
    const res = await GET(makeReq(), { params: Promise.resolve({ jobId: 'job-123' }) });
    expect(res.status).toBe(200);
  });

  it('returns 200 for valid Bearer + publish:read scope', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthOk('u1', 'openclaw'));
    const { GET } = await import('./route');
    const res = await GET(makeReq(), { params: Promise.resolve({ jobId: 'job-123' }) });
    expect(res.status).toBe(200);
  });

  it('returns 403 when helper returns 403 (scope missing)', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthError(403));
    const { GET } = await import('./route');
    const res = await GET(makeReq(), { params: Promise.resolve({ jobId: 'job-123' }) });
    expect(res.status).toBe(403);
  });
});

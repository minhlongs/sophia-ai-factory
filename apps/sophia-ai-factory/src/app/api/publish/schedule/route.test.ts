/**
 * Route-level smoke tests for POST /api/publish/schedule — dual-auth.
 * Full coverage in src/lib/publishing/__tests__/schedule-api-route.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OpenClawAuthResult, OpenClawAuthError } from '@/seed/auth/get-current-user-or-openclaw';

const mocks = vi.hoisted(() => ({
  schedulePublish: vi.fn().mockResolvedValue({ jobIds: ['j1'], quotaBlocked: [] }),
  getCurrentUserOrOpenClaw: vi.fn(),
  isAuthError: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/seed/utils/logger-utility', () => ({ logger: mocks.logger }));
vi.mock('@/lib/publishing/scheduler', () => ({ schedulePublish: mocks.schedulePublish }));
vi.mock('@/seed/auth/get-current-user-or-openclaw', () => ({
  getCurrentUserOrOpenClaw: mocks.getCurrentUserOrOpenClaw,
  isAuthError: mocks.isAuthError,
}));

import { POST } from './route';
import { NextResponse } from 'next/server';

const VALID_BODY = {
  videoJobId: '550e8400-e29b-41d4-a716-446655440000',
  channels: ['ch1'],
  caption: 'test caption',
  hashtags: [],
};

function makeReq(body?: unknown) {
  return new Request('http://localhost/api/publish/schedule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? VALID_BODY),
  });
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

describe('POST /api/publish/schedule — dual-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.schedulePublish.mockResolvedValue({ jobIds: ['j1'], quotaBlocked: [] });
    // Default: isAuthError returns false (success path)
    mocks.isAuthError.mockImplementation((r: { _type: string }) => r._type === 'auth_error');
  });

  it('returns 401 when no auth', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthError(401));
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });

  it('returns 201 for valid cookie auth', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthOk('u1', 'cookie'));
    const res = await POST(makeReq());
    expect(res.status).toBe(201);
  });

  it('returns 201 for valid Bearer + publish:write scope', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthOk('u2', 'openclaw'));
    const res = await POST(makeReq());
    expect(res.status).toBe(201);
  });

  it('returns 403 when helper returns 403 (scope missing)', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthError(403));
    const res = await POST(makeReq());
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid body (missing channels) with valid auth', async () => {
    mocks.getCurrentUserOrOpenClaw.mockResolvedValueOnce(makeAuthOk('u1'));
    const res = await POST(makeReq({ videoJobId: '00000000-0000-0000-0000-000000000001', caption: 'c' }));
    expect(res.status).toBe(400);
  });
});

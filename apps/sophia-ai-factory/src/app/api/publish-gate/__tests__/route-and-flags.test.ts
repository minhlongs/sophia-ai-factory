// @vitest-environment node
/**
 * Route & Flag unit tests for /api/publish-gate and FEATURE_B2_COMPLIANCE_PUBLISH_GATE.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mockGetCurrentUser = vi.fn();
const mockResolveOrgId = vi.fn();
const mockVerifyWorkspaceAccess = vi.fn();
const mockVerifyWorkspaceRole = vi.fn();
const mockGetD1 = vi.fn();
const mockVerifyCsrfToken = vi.fn();
const mockInngestSend = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  resolveOrgId: (...args: unknown[]) => mockResolveOrgId(...args),
  verifyWorkspaceAccess: (...args: unknown[]) => mockVerifyWorkspaceAccess(...args),
  verifyWorkspaceRole: (...args: unknown[]) => mockVerifyWorkspaceRole(...args),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: () => mockGetD1(),
}));

vi.mock('@/seed/security/csrf', () => ({
  verifyCsrfToken: (...args: unknown[]) => mockVerifyCsrfToken(...args),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: (...args: unknown[]) => mockInngestSend(...args),
  },
}));

import { isB2CompliancePublishGateEnabled } from '@/seed/config/flags';
import { GET, POST } from '../route';

function makeNextReq(method: 'GET' | 'POST', body?: unknown): NextRequest {
  return new Request('https://localhost/api/publish-gate', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }) as unknown as NextRequest;
}

describe('FEATURE_B2_COMPLIANCE_PUBLISH_GATE flag & /api/publish-gate route', () => {
  const originalFlag = process.env.FEATURE_B2_COMPLIANCE_PUBLISH_GATE;
  const originalInngestKey = process.env.INNGEST_EVENT_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.FEATURE_B2_COMPLIANCE_PUBLISH_GATE;
    delete process.env.INNGEST_EVENT_KEY;
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.FEATURE_B2_COMPLIANCE_PUBLISH_GATE;
    } else {
      process.env.FEATURE_B2_COMPLIANCE_PUBLISH_GATE = originalFlag;
    }
    if (originalInngestKey === undefined) {
      delete process.env.INNGEST_EVENT_KEY;
    } else {
      process.env.INNGEST_EVENT_KEY = originalInngestKey;
    }
  });

  it('defaults FEATURE_B2_COMPLIANCE_PUBLISH_GATE to false and enables only on exact "true"', () => {
    expect(isB2CompliancePublishGateEnabled()).toBe(false);
    process.env.FEATURE_B2_COMPLIANCE_PUBLISH_GATE = '1';
    expect(isB2CompliancePublishGateEnabled()).toBe(false);
    process.env.FEATURE_B2_COMPLIANCE_PUBLISH_GATE = 'true';
    expect(isB2CompliancePublishGateEnabled()).toBe(true);
  });

  it('returns 404 FEATURE_DISABLED on GET and POST when flag is off', async () => {
    const getRes = await GET(makeNextReq('GET'));
    const postRes = await POST(makeNextReq('POST', {}));
    expect(getRes.status).toBe(404);
    expect(postRes.status).toBe(404);
  });

  it('returns 401 when unauthenticated and 503 when D1 is unavailable', async () => {
    process.env.FEATURE_B2_COMPLIANCE_PUBLISH_GATE = 'true';
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const unauthRes = await GET(makeNextReq('GET'));
    expect(unauthRes.status).toBe(401);

    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user_1' });
    mockGetD1.mockResolvedValueOnce(null);
    const d1DownRes = await GET(makeNextReq('GET'));
    expect(d1DownRes.status).toBe(503);
  });

  it('delegates GET list and POST CSRF/RBAC checks through live route dependencies', async () => {
    process.env.FEATURE_B2_COMPLIANCE_PUBLISH_GATE = 'true';
    const fakeD1 = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          all: vi.fn(async () => ({ results: [] })),
        })),
      })),
    };
    mockGetCurrentUser.mockResolvedValue({ id: 'user_1' });
    mockGetD1.mockResolvedValue(fakeD1);
    mockResolveOrgId.mockResolvedValue('org_1');
    mockVerifyWorkspaceAccess.mockResolvedValue(true);
    mockVerifyWorkspaceRole.mockResolvedValue(true);
    mockVerifyCsrfToken.mockResolvedValue(false);

    const getRes = await GET(makeNextReq('GET'));
    expect(getRes.status).toBe(200);
    expect(mockVerifyWorkspaceAccess).toHaveBeenCalledWith('org_1', 'user_1', fakeD1);

    const postCsrfFail = await POST(makeNextReq('POST', { action: 'create' }));
    expect(postCsrfFail.status).toBe(403);

    mockVerifyCsrfToken.mockResolvedValueOnce(true);
    mockVerifyWorkspaceRole.mockResolvedValueOnce(false);
    const postViewerFail = await POST(makeNextReq('POST', { action: 'create' }));
    expect(postViewerFail.status).toBe(403);
  });
});

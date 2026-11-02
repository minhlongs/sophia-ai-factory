/**
 * Deterministic Integration Tests for W1–W2 ($0.00 Web Campaign Approval Queue)
 * and S3 Route Handler Fail-Closed Workspace Guards.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockGetCurrentUser,
  mockGetCurrentUserFromHeaders,
  mockGetCurrentUserOrOpenclawBearer,
  mockGetUserWorkspaceIds,
  mockHasWorkspaceRole,
  mockResolveOrgId,
  mockGetD1,
  mockListTenantApprovals,
  mockGetCampaignApprovalById,
  mockRejectCampaignApproval,
  mockExchangeCodeForTokens,
  mockGetChannelInfo,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockGetCurrentUserFromHeaders: vi.fn(),
  mockGetCurrentUserOrOpenclawBearer: vi.fn(),
  mockGetUserWorkspaceIds: vi.fn(),
  mockHasWorkspaceRole: vi.fn(),
  mockResolveOrgId: vi.fn(),
  mockGetD1: vi.fn(),
  mockListTenantApprovals: vi.fn(),
  mockGetCampaignApprovalById: vi.fn(),
  mockRejectCampaignApproval: vi.fn(),
  mockExchangeCodeForTokens: vi.fn(),
  mockGetChannelInfo: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
  getCurrentUserFromHeaders: mockGetCurrentUserFromHeaders,
}));
vi.mock('@/seed/auth/openclaw-token', () => ({
  getCurrentUserOrOpenclawBearer: mockGetCurrentUserOrOpenclawBearer,
}));
vi.mock('@/seed/auth/workspace-access', () => ({
  getUserWorkspaceIds: mockGetUserWorkspaceIds,
  hasWorkspaceRole: mockHasWorkspaceRole,
}));
vi.mock('@/seed/auth/resolve-org-id', () => ({ resolveOrgId: mockResolveOrgId }));
vi.mock('@/seed/db/client', () => ({ getD1: mockGetD1, createServerClient: vi.fn(() => ({})) }));
vi.mock('@/land/youtube/youtube-oauth-client', () => ({
  exchangeCodeForTokens: mockExchangeCodeForTokens,
  getChannelInfo: mockGetChannelInfo,
}));
vi.mock('@/tree/affiliate/approval/campaign-approval-repo', () => ({
  listTenantApprovals: mockListTenantApprovals,
  getCampaignApprovalById: mockGetCampaignApprovalById,
  rejectCampaignApproval: mockRejectCampaignApproval,
  approveCampaignApprovalCAS: vi.fn(),
  revokeCampaignApproval: vi.fn(),
  markApprovalExecuted: vi.fn(),
}));

import { GET as listApprovalsGET } from '@/app/api/campaign-approvals/route';
import { PATCH as resolveApprovalPATCH } from '@/app/api/campaign-approvals/[id]/route';
import { POST as registerChannelPOST } from '@/app/api/publish/channels/route';
import { GET as youtubeCallbackGET } from '@/app/api/oauth/youtube/callback/route';

async function buildSignedOauthState(userId: string, secret: string): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ userId, ts: Date.now() })).toString('base64url');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${payload}.${Buffer.from(sigBuf).toString('base64url')}`;
}

describe('W1 & S3 Route Handler Integration: Solo/Org Approvals & Fail-Closed Channels', () => {
  const soloUserId = 'usr_solo_ceo_01';
  const orgId = 'org_enterprise_01';
  const fakeD1 = {} as D1Database;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.OAUTH_STATE_SECRET = 'test_oauth_state_secret_32_bytes_long';
    mockGetD1.mockResolvedValue(fakeD1);
    mockGetCurrentUser.mockResolvedValue({ id: soloUserId, email: 'solo@example.com' });
    mockGetCurrentUserFromHeaders.mockResolvedValue({ id: soloUserId, email: 'solo@example.com' });
    mockGetCurrentUserOrOpenclawBearer.mockResolvedValue({ id: soloUserId, email: 'solo@example.com' });
  });

  afterEach(() => {
    delete process.env.OAUTH_STATE_SECRET;
  });

  it('allows a solo workspace owner (workspaceId === user.id) to list and reject approvals at $0.00 (W1)', async () => {
    mockGetUserWorkspaceIds.mockResolvedValue([]);
    mockListTenantApprovals.mockResolvedValue([
      {
        id: 'apr_solo_01',
        campaignId: 'cmp_saas_01',
        niche: 'saas_global',
        jurisdiction: 'GLOBAL',
        status: 'pending_ceo',
        approvalPayloadHash: 'sha256_hash_1234567890',
        approvedBy: null,
        approvedAtMs: null,
        payloadJson: JSON.stringify({ maxRenderCostCents: 150, affiliateTargetUrl: 'https://linear.app' }),
      },
    ]);

    const getRes = await listApprovalsGET(
      new NextRequest(`https://sophia.agencyos.network/api/campaign-approvals?workspaceId=${soloUserId}`),
    );
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { count: number; approvals: Array<{ id: string }> };
    expect(getBody.count).toBe(1);
    expect(getBody.approvals[0]?.id).toBe('apr_solo_01');

    mockGetCampaignApprovalById.mockImplementation(async (_db: unknown, wid: string, id: string) =>
      wid === soloUserId && id === 'apr_solo_01'
        ? { id: 'apr_solo_01', tenantId: soloUserId, status: 'pending_ceo' }
        : null,
    );
    mockRejectCampaignApproval.mockResolvedValue({
      ok: true,
      value: { id: 'apr_solo_01', status: 'rejected' },
    });

    const patchRes = await resolveApprovalPATCH(
      new NextRequest('https://sophia.agencyos.network/api/campaign-approvals/apr_solo_01', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject', reason: '$0.00 dry-run' }),
      }),
      { params: Promise.resolve({ id: 'apr_solo_01' }) },
    );
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as { status: string };
    expect(patchBody.status).toBe('rejected');
    expect(mockHasWorkspaceRole).not.toHaveBeenCalled();
  });

  it('forwards d1 to hasWorkspaceRole for org approvals and blocks non-admin org members with 403 (W1)', async () => {
    mockGetUserWorkspaceIds.mockResolvedValue([orgId]);
    mockGetCampaignApprovalById.mockImplementation(async (_db: unknown, wid: string, id: string) =>
      wid === orgId && id === 'apr_org_01'
        ? { id: 'apr_org_01', tenantId: orgId, status: 'pending_ceo' }
        : null,
    );
    mockHasWorkspaceRole.mockResolvedValueOnce(false);

    const patchRes = await resolveApprovalPATCH(
      new NextRequest('https://sophia.agencyos.network/api/campaign-approvals/apr_org_01', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject', reason: 'Non-admin attempt' }),
      }),
      { params: Promise.resolve({ id: 'apr_org_01' }) },
    );
    expect(patchRes.status).toBe(403);
    expect(mockHasWorkspaceRole).toHaveBeenCalledWith(orgId, soloUserId, 'ADMIN', fakeD1);
  });

  it('fails closed on POST /api/publish/channels and GET /api/oauth/youtube/callback (S3)', async () => {
    mockResolveOrgId.mockRejectedValueOnce(new Error('D1_CONNECTION_LOST'));
    const postRes = await registerChannelPOST(
      new NextRequest('https://sophia.agencyos.network/api/publish/channels', {
        method: 'POST',
        body: JSON.stringify({
          provider: 'youtube',
          externalAccountId: 'UC_TEST_123',
          accessToken: 'ya29.test_token',
        }),
      }),
    );
    expect(postRes.status).toBe(502);

    const state = await buildSignedOauthState(soloUserId, process.env.OAUTH_STATE_SECRET!);
    mockResolveOrgId.mockResolvedValueOnce(orgId);
    mockHasWorkspaceRole.mockResolvedValueOnce(false);
    const cbForbiddenRes = await youtubeCallbackGET(
      new NextRequest(`https://sophia.agencyos.network/api/oauth/youtube/callback?code=c1&state=${state}`),
    );
    expect(cbForbiddenRes.headers.get('location')).toContain('error=workspace_forbidden');
    expect(mockExchangeCodeForTokens).not.toHaveBeenCalled();

    mockResolveOrgId.mockRejectedValueOnce(new Error('D1_DOWN'));
    const cbErrRes = await youtubeCallbackGET(
      new NextRequest(`https://sophia.agencyos.network/api/oauth/youtube/callback?code=c1&state=${state}`),
    );
    expect(cbErrRes.headers.get('location')).toContain('error=workspace_resolution_failed');
  });
});

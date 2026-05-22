/**
 * Unit tests: retryCampaign + resumeCampaign — IDOR ownership check (V-1.1)
 *
 * Scenarios:
 * (a) owner can retry/resume → success
 * (b) non-owner gets unauthorized
 * (c) unauthenticated gets unauthorized
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const {
  mockGetCurrentUser,
  mockDbSelect,
  mockDbUpdate,
  mockRevalidatePath,
  mockSendEvent,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbSelect: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockSendEvent: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

/** Build a chainable Supabase-like query builder stub */
function buildQueryStub(resolvedValue: unknown) {
  const stub = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    update: vi.fn().mockReturnThis(),
  };
  // update chain returns mockDbUpdate on .eq()
  stub.update.mockReturnValue({ eq: mockDbUpdate });
  return stub;
}

vi.mock('@/seed/db/client', () => ({
  getD1Client: vi.fn(async () => ({
    from: mockDbSelect,
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock('@/lib/campaigns/create-campaign-core', () => ({
  sendCampaignCreatedEvent: mockSendEvent,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const OWNER_ID = 'user-owner-123';
const OTHER_ID = 'user-other-456';

const FAILED_CAMPAIGN = {
  id: 'camp-1',
  status: 'failed',
  user_id: OWNER_ID,
  topic: 'Test topic',
  title: 'Test title',
  audience: 'General',
  script: null,
  video_url: null,
};

const USER_PROFILE = { subscription_tier: 'basic' };

function setupDbForCampaign(campaign: typeof FAILED_CAMPAIGN) {
  // .from() is called twice: once for campaigns, once for user_profiles
  let callCount = 0;
  mockDbSelect.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // campaigns query
      return buildQueryStub({ data: campaign, error: null });
    }
    // user_profiles query
    return buildQueryStub({ data: USER_PROFILE, error: null });
  });
  mockDbUpdate.mockResolvedValue({ error: null });
  mockSendEvent.mockResolvedValue(undefined);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});

describe('retryCampaign — IDOR ownership check', () => {
  it('(a) owner can retry own failed campaign → success', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: OWNER_ID, email: 'owner@test.com' });
    setupDbForCampaign(FAILED_CAMPAIGN);

    const { retryCampaign } = await import('../campaigns-retry-resume');
    const result = await retryCampaign('camp-1');

    expect(result.success).toBe(true);
    expect(result.message).toBe('Campaign retry initiated');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/campaigns');
  });

  it('(b) non-owner gets unauthorized', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: OTHER_ID, email: 'other@test.com' });
    setupDbForCampaign(FAILED_CAMPAIGN);

    const { retryCampaign } = await import('../campaigns-retry-resume');
    const result = await retryCampaign('camp-1');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unauthorized');
    expect(mockSendEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('(c) unauthenticated user gets unauthorized', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { retryCampaign } = await import('../campaigns-retry-resume');
    const result = await retryCampaign('camp-1');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unauthorized');
  });
});

describe('resumeCampaign — IDOR ownership check', () => {
  it('(a) owner can resume own failed campaign → success', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: OWNER_ID, email: 'owner@test.com' });
    setupDbForCampaign(FAILED_CAMPAIGN);

    const { resumeCampaign } = await import('../campaigns-retry-resume');
    const result = await resumeCampaign('camp-1');

    expect(result.success).toBe(true);
    expect(result.message).toContain('Campaign resumed');
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/campaigns');
  });

  it('(b) non-owner gets unauthorized', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: OTHER_ID, email: 'other@test.com' });
    setupDbForCampaign(FAILED_CAMPAIGN);

    const { resumeCampaign } = await import('../campaigns-retry-resume');
    const result = await resumeCampaign('camp-1');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unauthorized');
    expect(mockSendEvent).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it('(c) unauthenticated user gets unauthorized', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { resumeCampaign } = await import('../campaigns-retry-resume');
    const result = await resumeCampaign('camp-1');

    expect(result.success).toBe(false);
    expect(result.message).toBe('Unauthorized');
  });
});

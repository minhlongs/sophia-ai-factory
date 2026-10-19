import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  resolveOrgId: vi.fn(),
  resolveUserTier: vi.fn(),
  checkMonthlyCampaignLimit: vi.fn(),
  tierGuard: { checkMultiChannelAccess: vi.fn() },
  createServerClient: vi.fn(),
  getD1: vi.fn(),
}));
vi.mock('@/seed/auth/better-auth-session', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/seed/auth/workspace-access', () => ({ resolveOrgId: mocks.resolveOrgId }));
vi.mock('@/seed/db/resolve-user-tier', () => ({ resolveUserTier: mocks.resolveUserTier }));
vi.mock('@/land/campaigns', () => ({ checkMonthlyCampaignLimit: mocks.checkMonthlyCampaignLimit }));
vi.mock('@/land/tier-guard', () => ({ tierGuard: mocks.tierGuard }));
vi.mock('@/seed/db/client', () => ({ createServerClient: mocks.createServerClient, getD1: mocks.getD1 }));

import { authorizeCampaignCreation, checkMultiChannelAccess } from './campaigns-guard-helpers';

describe('campaign authorization guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createServerClient.mockReturnValue({});
    mocks.resolveUserTier.mockResolvedValue('PREMIUM');
    mocks.getD1.mockResolvedValue({ prepare: vi.fn() });
    mocks.checkMonthlyCampaignLimit.mockResolvedValue({ allowed: true, monthLimit: 100 });
  });

  it('rejects unauthenticated campaign creation', async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    await expect(authorizeCampaignCreation()).resolves.toEqual({ error: 'Vui lòng đăng nhập để tạo chiến dịch.' });
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it('rejects users without an organization', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    mocks.resolveOrgId.mockResolvedValue(null);

    await expect(authorizeCampaignCreation()).resolves.toEqual({ error: 'Forbidden: user is not a member of any organization' });
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('fails closed when D1 is unavailable', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    mocks.resolveOrgId.mockResolvedValue('org-1');
    mocks.getD1.mockResolvedValue(null);

    await expect(authorizeCampaignCreation()).rejects.toThrow('D1 database binding not available');
  });

  it('rejects campaign creation when the monthly quota is exhausted', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    mocks.resolveOrgId.mockResolvedValue('org-1');
    mocks.checkMonthlyCampaignLimit.mockResolvedValue({ allowed: false, monthLimit: 8 });

    await expect(authorizeCampaignCreation()).resolves.toEqual({
      error: 'Monthly campaign limit reached (8). Upgrade your plan for more.',
    });
  });

  it('returns the authenticated organization context when quota remains', async () => {
    const d1db = { prepare: vi.fn() };
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-1' });
    mocks.resolveOrgId.mockResolvedValue('org-1');
    mocks.getD1.mockResolvedValue(d1db);

    await expect(authorizeCampaignCreation()).resolves.toEqual({ userId: 'user-1', orgId: 'org-1', d1db, tier: 'PREMIUM' });
    expect(mocks.checkMonthlyCampaignLimit).toHaveBeenCalledWith('user-1', 'PREMIUM');
  });

  it.each([true, false])('delegates multi-channel access and returns %s', async (allowed) => {
    mocks.tierGuard.checkMultiChannelAccess.mockResolvedValue(allowed);

    await expect(checkMultiChannelAccess('user-1')).resolves.toBe(allowed);
    expect(mocks.tierGuard.checkMultiChannelAccess).toHaveBeenCalledWith('user-1');
  });
});

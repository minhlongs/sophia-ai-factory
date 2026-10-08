import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evalCampaignRoiAction } from '../eval-campaign-roi';
import { executeWinnerTakeAllBidding } from '../winner-take-all-bidding';
import { getCurrentUser } from '@/seed/auth/better-auth-session';

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('../winner-take-all-bidding', () => ({
  executeWinnerTakeAllBidding: vi.fn(),
}));

describe('evalCampaignRoiAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails if unauthorized', async () => {
    (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await evalCampaignRoiAction({
      campaignDateRangeStart: 1000,
      campaignDateRangeEnd: 2000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result.error as any).code).toBe('UNAUTHORIZED');
    }
  });
  
  it('fails if date range is invalid', async () => {
    (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'u1',
      role: 'admin'
    });

    const result = await evalCampaignRoiAction({
      campaignDateRangeStart: 2000,
      campaignDateRangeEnd: 1000,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result.error as any).code).toBe('VALIDATION_ERROR');
    }
  });

  it('delegates to executeWinnerTakeAllBidding on success', async () => {
    (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'u1',
      role: 'admin'
    });

    (executeWinnerTakeAllBidding as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      value: { culledCount: 8, duplicatedCount: 2, batchId: 'b1' }
    });

    const result = await evalCampaignRoiAction({
      campaignDateRangeStart: 1000,
      campaignDateRangeEnd: 2000,
    });

    expect(result.ok).toBe(true);
    expect(executeWinnerTakeAllBidding).toHaveBeenCalledWith({
      tenantId: 'default',
      userId: 'u1',
      campaignDateRangeStart: 1000,
      campaignDateRangeEnd: 2000
    });
  });
});

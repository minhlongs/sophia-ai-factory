import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWinnerTakeAllBidding } from '../winner-take-all-bidding';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';

vi.mock('@/seed/db/client', () => ({
  createServerClient: vi.fn(),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn(),
  },
}));

describe('executeWinnerTakeAllBidding', () => {
  const mockDbParams = {
    all: vi.fn(),
    run: vi.fn(),
  };

  const mockPrepare = vi.fn(() => ({
    bind: vi.fn(() => mockDbParams),
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    (createServerClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      prepare: mockPrepare,
    });
  });

  it('handles empty jobs gracefully', async () => {
    mockDbParams.all.mockResolvedValueOnce({ success: true, results: [] });

    const result = await executeWinnerTakeAllBidding({
      tenantId: 'tenant-123',
      userId: 'user-123',
      campaignDateRangeStart: 1000,
      campaignDateRangeEnd: 2000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.culledCount).toBe(0);
      expect(result.value.duplicatedCount).toBe(0);
    }
  });

  it('culls bottom 80% and duplicates top 20%', async () => {
    // 5 jobs so top 20% = 1 exactly, bottom 80% = 4
    const jobs = [
      { id: 'job-1', prompt: 'prompt 1' },
      { id: 'job-2', prompt: 'prompt 2' },
      { id: 'job-3', prompt: 'prompt 3' },
      { id: 'job-4', prompt: 'prompt 4' },
      { id: 'job-5', prompt: 'prompt 5' },
    ];
    mockDbParams.all.mockResolvedValueOnce({ success: true, results: jobs });
    mockDbParams.run.mockResolvedValueOnce({ success: true });

    const result = await executeWinnerTakeAllBidding({
      tenantId: 'tenant-123',
      userId: 'user-123',
      campaignDateRangeStart: 1000,
      campaignDateRangeEnd: 2000,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.culledCount).toBe(4);
      expect(result.value.duplicatedCount).toBe(1);
    }

    // Verify DB update and inngest send
    expect(mockPrepare).toHaveBeenCalledTimes(2); // One for select, one for update
    expect(inngest.send).toHaveBeenCalledTimes(1);
  });
});

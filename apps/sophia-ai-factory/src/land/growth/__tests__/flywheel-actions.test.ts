/**
 * Unit Tests for Growth Flywheel Server Actions
 * Layer: land/growth/__tests__ | Max LOC: < 200 | Zero :any
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getFlywheelStatsAction,
  triggerManualReseedAction,
} from '../flywheel-actions';

const { mockGetCurrentUser, mockInngestSend, mockGetStats, mockUpdateStatus } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockInngestSend: vi.fn().mockResolvedValue({}),
  mockGetStats: vi.fn(),
  mockUpdateStatus: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mockGetCurrentUser,
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: mockInngestSend,
  },
}));

vi.mock('../flywheel-coordinator', () => ({
  getFlywheelSummaryStats: mockGetStats,
  updateReseedJobStatus: mockUpdateStatus,
}));

describe('Flywheel Server Actions (Land Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFlywheelStatsAction', () => {
    it('returns UNAUTHORIZED failure when no user is logged in', async () => {
      mockGetCurrentUser.mockResolvedValueOnce(null);

      const res = await getFlywheelStatsAction();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns stats payload on authenticated request', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ id: 'user_active_1' });
      mockGetStats.mockResolvedValueOnce({
        totalReseedJobs: 5,
        alphaViralDetected: 2,
        reseededCount: 2,
        totalAttributedRevenueUsd: 500,
        totalCommissionUsd: 200,
      });

      const res = await getFlywheelStatsAction();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.alphaViralDetected).toBe(2);
        expect(res.value.totalAttributedRevenueUsd).toBe(500);
      }
    });
  });

  describe('triggerManualReseedAction', () => {
    it('dispatches reseed event and marks status PENDING', async () => {
      mockGetCurrentUser.mockResolvedValueOnce({ id: 'user_active_1' });

      const res = await triggerManualReseedAction({
        jobId: 'reseed_101',
        sourceJobId: 'src_999',
        channelId: 'chan_yt_1',
        platform: 'YOUTUBE_SHORTS',
        originalHook: 'Top 3 AI passive models',
        mutatedHooks: ['99% người bỏ qua điều này: Top 3 AI passive models'],
      });

      expect(res.ok).toBe(true);
      expect(mockUpdateStatus).toHaveBeenCalledWith('reseed_101', 'PENDING');
      expect(mockInngestSend).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'growth/v12.reseed.trigger',
        }),
      );
    });
  });
});

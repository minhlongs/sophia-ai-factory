/**
 * Unit Tests for Flywheel Lifecycle Coordinator
 * Layer: land/growth/__tests__ | Max LOC: < 200 | Zero :any
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createReseedJob,
  updateReseedJobStatus,
  getFlywheelSummaryStats,
} from '../flywheel-coordinator';

const { mockPrepare, mockRun, mockBind, mockFirst } = vi.hoisted(() => {
  const run = vi.fn();
  const first = vi.fn();
  const bind = vi.fn(() => ({ run, first }));
  const prepare = vi.fn(() => ({ bind }));
  return { mockPrepare: prepare, mockRun: run, mockBind: bind, mockFirst: first };
});

vi.mock('@/seed/db/client', () => ({
  getD1: () => ({
    prepare: mockPrepare,
  }),
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('Flywheel Coordinator (Land Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates reseed job successfully with optimistic concurrency', async () => {
    mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });

    const ok = await createReseedJob({
      id: 'job_reseed_1',
      userId: 'user_123',
      sourceJobId: 'src_999',
      channelId: 'chan_yt_1',
      platform: 'YOUTUBE_SHORTS',
      retentionZScore: 2.2,
      classification: 'ALPHA_VIRAL',
      originalHook: 'Top 3 passive income models',
      mutatedHooks: ['Bí quyết ít người biết: Top 3 passive income models'],
    });

    expect(ok).toBe(true);
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO flywheel_reseed_jobs'));
  });

  it('updates reseed job status correctly', async () => {
    mockRun.mockResolvedValueOnce({ meta: { changes: 1 } });

    const ok = await updateReseedJobStatus('job_reseed_1', 'RESEEDED', 'camp_new_77');
    expect(ok).toBe(true);
    expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE flywheel_reseed_jobs'));
  });

  it('aggregates summary stats from D1 correctly', async () => {
    mockFirst
      .mockResolvedValueOnce({ totalJobs: 10, alphaCount: 4, reseededCount: 3 })
      .mockResolvedValueOnce({ totalGross: 1250.0, totalCommission: 480.0 });

    const stats = await getFlywheelSummaryStats('user_123');

    expect(stats.totalReseedJobs).toBe(10);
    expect(stats.alphaViralDetected).toBe(4);
    expect(stats.reseededCount).toBe(3);
    expect(stats.totalAttributedRevenueUsd).toBe(1250.0);
    expect(stats.totalCommissionUsd).toBe(480.0);
  });
});

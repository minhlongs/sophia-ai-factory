import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ingestPostPublishFeedback,
  updateBayesianPrior,
  getFeedbackSummary,
} from '../feedback-coordinator';
import * as clientModule from '@/seed/db/client';
import type { PostPublishFeedback } from '@/seed/types/growth-triad-v15';

describe('Land v15: Feedback Coordinator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists post-publish feedback with normalized retention scores', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);

    const feedback: PostPublishFeedback = {
      id: 'fb-001',
      userId: 'usr-1',
      videoManifestId: 'vm-001',
      channelId: 'chan-001',
      platform: 'YOUTUBE_SHORTS',
      views: 1200,
      watchTimeSeconds: 36000,
      durationSeconds: 60,
      retentionCurve: [
        { timePct: 0, retentionPct: 100 },
        { timePct: 50, retentionPct: 70 },
        { timePct: 100, retentionPct: 50 },
      ],
      collectedAt: 1728460000000,
    };

    const res = await ingestPostPublishFeedback(feedback);
    expect(res).toBe(true);
    expect(mockPrepare).toHaveBeenCalled();
  });

  it('updates Bayesian conjugate prior in D1', async () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockBind = vi.fn().mockReturnValue({ run: mockRun });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);

    const res = await updateBayesianPrior('usr-1', 'platform', 'YOUTUBE_SHORTS', {
      currentAlpha: 1.0,
      currentBeta: 1.0,
      sampleSize: 100,
      observedScore: 0.85,
    });

    expect(res).toBe(true);
    expect(mockBind).toHaveBeenCalled();
  });

  it('aggregates summary statistics accurately', async () => {
    const mockFirst = vi.fn().mockResolvedValue({
      total: 5,
      avgScore: 0.72,
      highPerformers: 3,
      lastUpdated: 1728470000000,
    });
    const mockBind = vi.fn().mockReturnValue({ first: mockFirst });
    const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });
    const mockDb = { prepare: mockPrepare };

    vi.spyOn(clientModule, 'getD1').mockResolvedValue(mockDb as unknown as D1Database);

    const summary = await getFeedbackSummary('usr-1');
    expect(summary.totalFeedbacksIngested).toBe(5);
    expect(summary.averageNormalizedRetention).toBe(0.72);
    expect(summary.highPerformersIdentified).toBe(3);
    expect(summary.lastUpdated).toBe(1728470000000);
  });
});

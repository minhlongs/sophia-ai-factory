/**
 * @file growth-triad-v6-actions.test.ts
 * @description Unit tests for Growth Triad v6 Server Actions
 * @layer land
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  detectAndJackSeoSurgeAction,
  optimizeSmartLinkAction,
  analyzeVideoRetentionAction,
} from '../actions/growth-triad-v6-actions';

const mockRun = vi.fn().mockResolvedValue({ success: true });
const mockAll = vi.fn().mockResolvedValue({
  results: [
    {
      id: 'off-cb-1',
      name: 'Sophia Affiliate Master',
      network: 'CLICKBANK',
      targetUrl: 'https://hop.clickbank.net/?aff=test',
      epcUsd: 5.0,
      gravity: 81,
      refundRatePct: 4,
      commissionPct: 40,
      niche: 'saas_video',
    },
  ],
});
const mockBind = vi.fn().mockReturnValue({ run: mockRun, all: mockAll });
const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    prepare: mockPrepare,
  }),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({ id: 'usr-growth-v6', email: 'v6@sophia.test' }),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt-mock-id'] }),
  },
}));

describe('Growth Triad v6 Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs detectAndJackSeoSurgeAction and triggers surge event when surging', async () => {
    const history = [
      { timestamp: 1000, velocity: 100 },
      { timestamp: 2000, velocity: 110 },
      { timestamp: 3000, velocity: 105 },
    ];
    const res = await detectAndJackSeoSurgeAction({
      keyword: 'ai video prompt mastery',
      history,
      currentVelocity: 850,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.analysis.isSurging).toBe(true);
      expect(res.metadata.title).toContain('ai video prompt mastery');
      expect(mockPrepare).toHaveBeenCalled();
    }
  });

  it('runs optimizeSmartLinkAction and matches highest yield offer', async () => {
    const res = await optimizeSmartLinkAction({
      videoNiche: 'saas_video',
      userCountryCode: 'US',
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.match).not.toBeNull();
      expect(res.match?.offerId).toBe('off-cb-1');
      expect(res.match?.expectedYieldUsd).toBeGreaterThan(0);
    }
  });

  it('runs analyzeVideoRetentionAction and computes survival report', async () => {
    const buckets = [
      { second: 0, viewers: 500, dropoffs: 0 },
      { second: 15, viewers: 480, dropoffs: 100 }, // drop cliff
      { second: 30, viewers: 350, dropoffs: 10 },
    ];

    const res = await analyzeVideoRetentionAction({
      videoId: 'vid-v6-test',
      buckets,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.status).toBeDefined();
      expect(res.cliffs.length).toBeGreaterThanOrEqual(1);
    }
  });
});

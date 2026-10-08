/**
 * @file growth-triad-v7-actions.test.ts
 * @description Integration tests for Growth Triad v7 Server Actions
 * @layer land
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateAndPersistSponsorshipAction,
  processVideoReframeAction,
  auditThumbnailGazeAction,
} from '../actions/growth-triad-v7-actions';

const mockRun = vi.fn().mockResolvedValue({ success: true });
const mockBind = vi.fn().mockReturnValue({ run: mockRun });
const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

vi.mock('@/seed/db/client', () => ({
  createServerClient: () => ({
    prepare: mockPrepare,
  }),
}));

vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt-v7-mock'] }),
  },
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    id: 'usr-v7-creator',
    email: 'creator@sophia.agencyos.network',
  }),
}));

describe('Growth Triad v7 Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculateAndPersistSponsorshipAction returns valid pitch email & cardId', async () => {
    const res = await calculateAndPersistSponsorshipAction({
      channelId: 'chan-crypto-01',
      channelName: 'Crypto Quant Matrix',
      niche: 'CRYPTO',
      expected30dViews: 150000,
      engagementRate: 0.06,
      tier1AudiencePct: 75,
      baseCpmUsd: 25.0,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.cardId).toMatch(/^ratecard_/);
      expect(res.pitchEmail.rateCard.dedicatedVideoUsd).toBeGreaterThan(0);
      expect(res.pitchEmail.subject).toContain('Crypto Quant Matrix');
    }
  });

  it('processVideoReframeAction generates smoothed 9:16 crop & kinetic tokens', async () => {
    const res = await processVideoReframeAction({
      videoId: 'vid-reframe-101',
      sourceAspect: '16:9',
      targetAspect: '9:16',
      keyframes: [
        { timestampSec: 0, focalX: 0.5, focalY: 0.5, faceDetected: true },
        { timestampSec: 1, focalX: 0.6, focalY: 0.5, faceDetected: true },
      ],
      transcript: [
        { text: 'Scale your income with AI', startSec: 0, endSec: 2 },
      ],
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.output.cropWindows).toHaveLength(2);
      expect(res.output.tokens.length).toBeGreaterThan(0);
      expect(res.output.targetAspect).toBe('9:16');
    }
  });

  it('auditThumbnailGazeAction computes saliency score and persists audit', async () => {
    const res = await auditThumbnailGazeAction({
      thumbnailId: 'thumb-ai-101',
      luminanceContrastRatio: 7.2,
      faceProminenceIndex: 0.85,
      colorSaturation: 0.9,
      ruleOfThirdsAdherence: 0.88,
      textOverlayAreaPct: 25,
    });

    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.analysisId).toMatch(/^gaze_/);
      expect(res.report.gazeFixationGrade).toBe('GRADE_A');
      expect(res.report.predictedCtrPct).toBeGreaterThan(10.0);
    }
  });
});

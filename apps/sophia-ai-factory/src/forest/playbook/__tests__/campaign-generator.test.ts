/**
 * Campaign Generator Unit Tests — Phase 5 Auto-Creative Playbook
 * Layer: forest
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlaybookPattern } from '@/seed/types/playbook-pattern';
import {
  generateCampaignBlueprint,
  saveCampaignBlueprint,
  MIN_PATTERN_CONFIDENCE,
  DEFAULT_ESTIMATED_COST_CENTS,
} from '../campaign-generator';

const mocks = vi.hoisted(() => ({
  mockListPatterns: vi.fn(),
  mockGetD1: vi.fn(),
  mockCreateServerClient: vi.fn(),
}));

vi.mock('@/forest/patterns/pattern-store', () => ({
  listPatterns: mocks.mockListPatterns,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.mockGetD1,
  createServerClient: mocks.mockCreateServerClient,
}));

vi.mock('@/seed/utils/logger-utility', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Campaign Generator — src/forest/playbook/campaign-generator', () => {
  const WS_ID = 'ws_test_gen_1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Winning Pattern Adoption (confidence >= 0.70)', () => {
    it('adopts winning hook style with confidence >= 0.70', async () => {
      const patterns: PlaybookPattern[] = [
        {
          id: 'pat_hook_bold',
          workspaceId: WS_ID,
          featureKey: 'hook_style',
          featureValue: 'bold_claim',
          metric: 'ctr',
          avgMetric: 0.14,
          sampleSize: 35,
          confidence: 0.88,
          confidenceLevel: 'high',
          source: 'mission',
          detectedAt: Date.now(),
        },
      ];

      const bp = await generateCampaignBlueprint(WS_ID, 'AI Tools', patterns);
      expect(bp.hookStyle).toBe('bold_claim');
      expect(bp.sourcePatternIds).toContain('pat_hook_bold');
    });

    it('adopts winning duration pattern (16-30s -> 25s) with confidence >= 0.70', async () => {
      const patterns: PlaybookPattern[] = [
        {
          id: 'pat_dur_30',
          workspaceId: WS_ID,
          featureKey: 'duration',
          featureValue: '16-30s',
          metric: 'ctr',
          avgMetric: 0.12,
          sampleSize: 40,
          confidence: 0.85,
          confidenceLevel: 'high',
          source: 'mission',
          detectedAt: Date.now(),
        },
      ];

      const bp = await generateCampaignBlueprint(WS_ID, 'Quick Tips', patterns);
      expect(bp.durationSeconds).toBe(25);
      expect(bp.estimatedScenes).toBe(3);
    });

    it('adopts winning voice style with confidence >= 0.70', async () => {
      const patterns: PlaybookPattern[] = [
        {
          id: 'pat_voice_rec',
          workspaceId: WS_ID,
          featureKey: 'voice_style',
          featureValue: 'enthusiastic_recommender',
          metric: 'conversion_rate',
          avgMetric: 0.09,
          sampleSize: 25,
          confidence: 0.78,
          confidenceLevel: 'medium',
          source: 'mission',
          detectedAt: Date.now(),
        },
      ];

      const bp = await generateCampaignBlueprint(WS_ID, 'Product Review', patterns);
      expect(bp.voiceStyle).toBe('enthusiastic_recommender');
      expect(bp.sourcePatternIds).toContain('pat_voice_rec');
    });

    it('adopts all three winning patterns concurrently', async () => {
      const patterns: PlaybookPattern[] = [
        {
          id: 'p_hook',
          workspaceId: WS_ID,
          featureKey: 'hook_style',
          featureValue: 'problem_agitation',
          metric: 'ctr',
          avgMetric: 0.15,
          sampleSize: 50,
          confidence: 0.92,
          confidenceLevel: 'high',
          source: 'mission',
          detectedAt: 100,
        },
        {
          id: 'p_dur',
          workspaceId: WS_ID,
          featureKey: 'duration',
          featureValue: '0-15s',
          metric: 'retention',
          avgMetric: 0.75,
          sampleSize: 50,
          confidence: 0.95,
          confidenceLevel: 'high',
          source: 'mission',
          detectedAt: 100,
        },
        {
          id: 'p_voice',
          workspaceId: WS_ID,
          featureKey: 'voice_style',
          featureValue: 'calm_authoritative',
          metric: 'ctr',
          avgMetric: 0.11,
          sampleSize: 30,
          confidence: 0.82,
          confidenceLevel: 'high',
          source: 'mission',
          detectedAt: 100,
        },
      ];

      const bp = await generateCampaignBlueprint(WS_ID, 'Finance Tips', patterns);
      expect(bp.hookStyle).toBe('problem_agitation');
      expect(bp.durationSeconds).toBe(15);
      expect(bp.estimatedScenes).toBe(3);
      expect(bp.voiceStyle).toBe('calm_authoritative');
      expect(bp.sourcePatternIds).toEqual(['p_hook', 'p_dur', 'p_voice']);
    });
  });

  describe('2. Fallback Defaults when Data is Insufficient (< 0.70)', () => {
    it('falls back to curiosity_gap hook when hook pattern confidence < 0.70', async () => {
      const patterns: PlaybookPattern[] = [
        {
          id: 'p_low_hook',
          workspaceId: WS_ID,
          featureKey: 'hook_style',
          featureValue: 'question',
          metric: 'ctr',
          avgMetric: 0.04,
          sampleSize: 4,
          confidence: 0.45,
          confidenceLevel: 'low',
          source: 'mission',
          detectedAt: 100,
        },
      ];

      const bp = await generateCampaignBlueprint(WS_ID, 'New Feature', patterns);
      expect(bp.hookStyle).toBe('curiosity_gap');
      expect(bp.sourcePatternIds).not.toContain('p_low_hook');
    });

    it('falls back to 60s duration and 5 scenes when duration confidence < 0.70', async () => {
      const patterns: PlaybookPattern[] = [
        {
          id: 'p_low_dur',
          workspaceId: WS_ID,
          featureKey: 'duration',
          featureValue: '16-30s',
          metric: 'ctr',
          avgMetric: 0.05,
          sampleSize: 3,
          confidence: 0.35,
          confidenceLevel: 'low',
          source: 'mission',
          detectedAt: 100,
        },
      ];

      const bp = await generateCampaignBlueprint(WS_ID, 'New Feature', patterns);
      expect(bp.durationSeconds).toBe(60);
      expect(bp.estimatedScenes).toBe(5);
    });

    it('falls back to dynamic_hook voice when voice confidence < 0.70', async () => {
      const patterns: PlaybookPattern[] = [
        {
          id: 'p_low_voice',
          workspaceId: WS_ID,
          featureKey: 'voice_style',
          featureValue: 'cinematic_narrator',
          metric: 'ctr',
          avgMetric: 0.06,
          sampleSize: 3,
          confidence: 0.50,
          confidenceLevel: 'medium',
          source: 'mission',
          detectedAt: 100,
        },
      ];

      const bp = await generateCampaignBlueprint(WS_ID, 'New Feature', patterns);
      expect(bp.voiceStyle).toBe('dynamic_hook');
    });

    it('falls back to complete defaults when patterns array is empty', async () => {
      const bp = await generateCampaignBlueprint(WS_ID, 'Clean Workspace', []);
      expect(bp.hookStyle).toBe('curiosity_gap');
      expect(bp.durationSeconds).toBe(60);
      expect(bp.estimatedScenes).toBe(5);
      expect(bp.voiceStyle).toBe('dynamic_hook');
      expect(bp.sourcePatternIds).toEqual([]);
      expect(bp.isActive).toBe(true);
      expect(bp.estimatedCostCents).toBe(DEFAULT_ESTIMATED_COST_CENTS);
    });

    it('fetches patterns from listPatterns store when patterns parameter is not provided', async () => {
      mocks.mockListPatterns.mockResolvedValue([
        {
          id: 'pat_fetched',
          workspaceId: WS_ID,
          featureKey: 'hook_style',
          featureValue: 'story_lead',
          metric: 'ctr',
          avgMetric: 0.16,
          sampleSize: 40,
          confidence: 0.91,
          confidenceLevel: 'high',
          source: 'mission',
          detectedAt: Date.now(),
        },
      ]);

      const bp = await generateCampaignBlueprint(WS_ID, 'Brand Story');
      expect(mocks.mockListPatterns).toHaveBeenCalledWith(WS_ID);
      expect(bp.hookStyle).toBe('story_lead');
    });

    it('handles listPatterns store failure gracefully by falling back to defaults', async () => {
      mocks.mockListPatterns.mockRejectedValue(new Error('D1 Connection Timeout'));

      const bp = await generateCampaignBlueprint(WS_ID, 'Fault Tolerance Test');
      expect(bp.hookStyle).toBe('curiosity_gap');
      expect(bp.voiceStyle).toBe('dynamic_hook');
      expect(bp.durationSeconds).toBe(60);
    });
  });

  describe('3. Platform and Aspect Ratio Adaptation', () => {
    it('sets targetPlatform youtube_shorts and aspect ratio 9:16 by default', async () => {
      const bp = await generateCampaignBlueprint(WS_ID, 'Shorts Trend', []);
      expect(bp.targetPlatform).toBe('youtube_shorts');
      expect(bp.aspectRatio).toBe('9:16');
    });

    it('sets targetPlatform tiktok and aspect ratio 9:16 for tiktok channel', async () => {
      const bp = await generateCampaignBlueprint(WS_ID, 'TikTok Trend', 'tiktok');
      expect(bp.targetPlatform).toBe('tiktok');
      expect(bp.aspectRatio).toBe('9:16');
    });

    it('sets targetPlatform instagram_reels and aspect ratio 9:16 for instagram channel', async () => {
      const bp = await generateCampaignBlueprint(WS_ID, 'Reels Trend', 'instagram_reels');
      expect(bp.targetPlatform).toBe('instagram_reels');
      expect(bp.aspectRatio).toBe('9:16');
    });

    it('sets aspect ratio 16:9 when preferredChannel is youtube', async () => {
      const bp = await generateCampaignBlueprint(WS_ID, 'Landscape Video', 'youtube');
      expect(bp.aspectRatio).toBe('16:9');
    });
  });

  describe('4. Bilingual Copy and Suggested Prompts', () => {
    it('generates bilingual names and descriptions containing topic', async () => {
      const bp = await generateCampaignBlueprint(WS_ID, 'SaaS Product Launch', []);
      expect(bp.name.en).toContain('SaaS Product Launch');
      expect(bp.name.vi).toContain('SaaS Product Launch');
      expect(bp.description.en).toContain('Automated campaign blueprint');
      expect(bp.description.vi).toContain('Kịch bản chiến dịch tự động');
    });

    it('generates bilingual suggestedPrompts matched to winning hook', async () => {
      const patterns: PlaybookPattern[] = [
        {
          id: 'p_stat',
          workspaceId: WS_ID,
          featureKey: 'hook_style',
          featureValue: 'statistic_reveal',
          metric: 'ctr',
          avgMetric: 0.13,
          sampleSize: 20,
          confidence: 0.85,
          confidenceLevel: 'medium',
          source: 'mission',
          detectedAt: 1,
        },
      ];
      const bp = await generateCampaignBlueprint(WS_ID, 'Market Analysis', patterns);
      expect(bp.suggestedPrompts).toHaveLength(1);
      expect(bp.suggestedPrompts[0].en).toContain('statistic_reveal');
      expect(bp.suggestedPrompts[0].vi).toContain('statistic_reveal');
      expect(bp.suggestedPrompts[0].en).toContain('Market Analysis');
    });
  });

  describe('5. Blueprint Persistence (saveCampaignBlueprint)', () => {
    it('persists blueprint to D1 campaign_blueprints table when D1 is available', async () => {
      const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
      const mockBind = vi.fn().mockReturnValue({ run: mockRun });
      const mockPrepare = vi.fn().mockReturnValue({ bind: mockBind });

      mocks.mockGetD1.mockResolvedValue({ prepare: mockPrepare });

      const bp = await generateCampaignBlueprint(WS_ID, 'Save Test', []);
      const saved = await saveCampaignBlueprint(bp);

      expect(saved).toBe(true);
      expect(mockPrepare).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO campaign_blueprints'));
    });

    it('falls back to createServerClient when getD1 returns null', async () => {
      mocks.mockGetD1.mockResolvedValue(null);
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      mocks.mockCreateServerClient.mockReturnValue({
        from: vi.fn().mockReturnValue({ insert: mockInsert }),
      });

      const bp = await generateCampaignBlueprint(WS_ID, 'Fallback Client Test', []);
      const saved = await saveCampaignBlueprint(bp);

      expect(saved).toBe(true);
      expect(mockInsert).toHaveBeenCalled();
    });

    it('returns false gracefully when database throws', async () => {
      mocks.mockGetD1.mockRejectedValue(new Error('D1 connection failed'));

      const bp = await generateCampaignBlueprint(WS_ID, 'Error Test', []);
      const saved = await saveCampaignBlueprint(bp);

      expect(saved).toBe(false);
    });
  });
});

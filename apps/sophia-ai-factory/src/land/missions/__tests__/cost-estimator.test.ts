/**
 * Unit tests for Pre-flight Cost & Latency Estimator
 * @module land/missions/__tests__/cost-estimator
 */

import { describe, it, expect } from 'vitest';
import {
  estimateMissionPreflight,
  estimateTemplateCost,
  calculateMcuCredits,
  FAL_AI_COST_PER_IMAGE_USD,
  ELEVENLABS_COST_PER_1K_CHARS_USD,
  OPENROUTER_SCRIPT_COST_USD,
  CHARS_PER_WORD_RATIO,
  type MissionPreflightEstimate,
} from '../cost-estimator';

describe('cost-estimator', () => {
  describe('Constants', () => {
    it('has correct provider pricing constants', () => {
      expect(FAL_AI_COST_PER_IMAGE_USD).toBe(0.025);
      expect(ELEVENLABS_COST_PER_1K_CHARS_USD).toBe(0.015);
      expect(OPENROUTER_SCRIPT_COST_USD).toBe(0.005);
      expect(CHARS_PER_WORD_RATIO).toBe(5.5);
    });
  });

  describe('calculateMcuCredits', () => {
    it('returns 30 MCU for 30-second videos', () => {
      expect(calculateMcuCredits(30)).toBe(30);
    });

    it('returns 40 MCU for 45-second videos', () => {
      expect(calculateMcuCredits(45)).toBe(40);
    });

    it('returns 50 MCU for 60-second videos (standard)', () => {
      expect(calculateMcuCredits(60)).toBe(50);
    });

    it('returns 50 MCU for videos longer than 45 seconds', () => {
      expect(calculateMcuCredits(90)).toBe(50);
      expect(calculateMcuCredits(120)).toBe(50);
    });
  });

  describe('estimateMissionPreflight', () => {
    it('returns complete estimate structure for 60s viral shorts', () => {
      const estimate = estimateMissionPreflight({
        durationSeconds: 60,
        estimatedScenes: 5,
        targetWordCount: 140,
      });

      expect(estimate).toHaveProperty('totalUsd');
      expect(estimate).toHaveProperty('totalMcu');
      expect(estimate).toHaveProperty('durationRangeSeconds');
      expect(estimate).toHaveProperty('breakdown');
      expect(estimate).toHaveProperty('stages');
      expect(estimate.isZeroHiddenFees).toBe(true);
    });

    it('calculates correct MCU for 60s video', () => {
      const estimate = estimateMissionPreflight({
        durationSeconds: 60,
        estimatedScenes: 5,
        targetWordCount: 140,
      });
      expect(estimate.totalMcu).toBe(50);
    });

    it('calculates correct MCU for 30s video', () => {
      const estimate = estimateMissionPreflight({
        durationSeconds: 30,
        estimatedScenes: 3,
        targetWordCount: 75,
      });
      expect(estimate.totalMcu).toBe(30);
    });

    it('calculates correct MCU for 45s video', () => {
      const estimate = estimateMissionPreflight({
        durationSeconds: 45,
        estimatedScenes: 4,
        targetWordCount: 110,
      });
      expect(estimate.totalMcu).toBe(40);
    });

    it('includes 3 breakdown items (fal.ai, ElevenLabs, OpenRouter)', () => {
      const estimate = estimateMissionPreflight({
        durationSeconds: 60,
        estimatedScenes: 5,
        targetWordCount: 140,
      });
      expect(estimate.breakdown).toHaveLength(3);
      const services = estimate.breakdown.map((b) => b.service);
      expect(services).toContain('fal.ai');
      expect(services).toContain('ElevenLabs');
      expect(services).toContain('OpenRouter');
    });

    it('fal.ai cost scales with scene count', () => {
      const estimate1 = estimateMissionPreflight({ durationSeconds: 60, estimatedScenes: 3, targetWordCount: 140 });
      const estimate2 = estimateMissionPreflight({ durationSeconds: 60, estimatedScenes: 5, targetWordCount: 140 });
      const fal1 = estimate1.breakdown.find((b) => b.service === 'fal.ai')?.estimatedUsd ?? 0;
      const fal2 = estimate2.breakdown.find((b) => b.service === 'fal.ai')?.estimatedUsd ?? 0;
      expect(fal2).toBeGreaterThan(fal1);
      expect(fal2).toBeCloseTo(5 * 0.025, 4);
    });

    it('ElevenLabs cost scales with word count', () => {
      const estimate1 = estimateMissionPreflight({ durationSeconds: 60, estimatedScenes: 5, targetWordCount: 100 });
      const estimate2 = estimateMissionPreflight({ durationSeconds: 60, estimatedScenes: 5, targetWordCount: 200 });
      const voice1 = estimate1.breakdown.find((b) => b.service === 'ElevenLabs')?.estimatedUsd ?? 0;
      const voice2 = estimate2.breakdown.find((b) => b.service === 'ElevenLabs')?.estimatedUsd ?? 0;
      expect(voice2).toBeGreaterThan(voice1);
    });

    it('OpenRouter cost is fixed per script', () => {
      const estimate = estimateMissionPreflight({ durationSeconds: 60, estimatedScenes: 5, targetWordCount: 140 });
      const script = estimate.breakdown.find((b) => b.service === 'OpenRouter');
      expect(script).toBeDefined();
      expect(script?.estimatedUsd).toBe(OPENROUTER_SCRIPT_COST_USD);
    });

    it('duration range is 45-90 seconds', () => {
      const estimate = estimateMissionPreflight({ durationSeconds: 60, estimatedScenes: 5, targetWordCount: 140 });
      expect(estimate.durationRangeSeconds.min).toBe(45);
      expect(estimate.durationRangeSeconds.max).toBe(90);
    });

    it('stages has 5 pipeline stages', () => {
      const estimate = estimateMissionPreflight({ durationSeconds: 60, estimatedScenes: 5, targetWordCount: 140 });
      expect(estimate.stages).toHaveLength(5);
      const stageIds = estimate.stages.map((s) => s.stageId);
      expect(stageIds).toEqual([
        'SCRIPT_GENERATION',
        'VOICE_SYNTHESIS',
        'VISUAL_GENERATION',
        'VIDEO_COMPOSITING',
        'READY_FOR_REVIEW',
      ]);
    });

    it('stages have bilingual labels and latency ranges', () => {
      const estimate = estimateMissionPreflight({ durationSeconds: 60, estimatedScenes: 5, targetWordCount: 140 });
      estimate.stages.forEach((stage) => {
        expect(stage.labelEn).toBeTruthy();
        expect(stage.labelVi).toBeTruthy();
        expect(stage.minSeconds).toBeGreaterThanOrEqual(0);
        if (stage.minSeconds > 0) {
          expect(stage.maxSeconds).toBeGreaterThan(stage.minSeconds);
        }
      });
    });

    it('totalUsd is sum of breakdown items', () => {
      const estimate = estimateMissionPreflight({ durationSeconds: 60, estimatedScenes: 5, targetWordCount: 140 });
      const sumBreakdown = estimate.breakdown.reduce((acc, b) => acc + b.estimatedUsd, 0);
      expect(estimate.totalUsd).toBeCloseTo(sumBreakdown, 3);
    });

    it('handles edge case with minimal inputs', () => {
      const estimate = estimateMissionPreflight({
        durationSeconds: 15,
        estimatedScenes: 1,
        targetWordCount: 10,
      });
      expect(estimate.totalMcu).toBe(30);
      expect(estimate.breakdown).toHaveLength(3);
    });
  });

  describe('estimateTemplateCost', () => {
    it('returns estimate for viral_shorts_explainer', () => {
      const estimate = estimateTemplateCost('viral_shorts_explainer');
      expect(estimate.totalMcu).toBe(50); // 60s
      expect(estimate.breakdown).toHaveLength(3);
    });

    it('returns estimate for affiliate_product_showcase', () => {
      const estimate = estimateTemplateCost('affiliate_product_showcase');
      expect(estimate.totalMcu).toBe(30); // 30s
      expect(estimate.breakdown).toHaveLength(3);
    });

    it('returns estimate for daily_news_wisdom', () => {
      const estimate = estimateTemplateCost('daily_news_wisdom');
      expect(estimate.totalMcu).toBe(40); // 45s
      expect(estimate.breakdown).toHaveLength(3);
    });

    it('falls back to default template for invalid ID', () => {
      const estimate = estimateTemplateCost('invalid' as any);
      expect(estimate.totalMcu).toBe(50); // Default is viral_shorts_explainer
    });
  });

  describe('Zero Hidden Fees Guarantee', () => {
    it('always returns isZeroHiddenFees = true', () => {
      const estimate = estimateMissionPreflight({ durationSeconds: 60, estimatedScenes: 5, targetWordCount: 140 });
      expect(estimate.isZeroHiddenFees).toBe(true);
    });
  });
});
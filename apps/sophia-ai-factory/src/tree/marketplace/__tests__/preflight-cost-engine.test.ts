/**
 * Unit Tests for Pre-Flight Cost Engine
 *
 * @module tree/marketplace/__tests__/preflight-cost-engine.test
 */

import { describe, it, expect } from 'vitest';
import {
  estimateBlueprintStudioCost,
  calculateVideoMcuAndUsd,
  MAX_SINGLE_MISSION_COST_CENTS,
  MCU_PER_CENT,
} from '../preflight-cost-engine';

describe('Pre-Flight Cost Engine', () => {
  describe('estimateBlueprintStudioCost', () => {
    it('accurately estimates cost for standard 6-scene, 30s video with 3 tracks', () => {
      // Formula: (50 + 30*2 + 6*40) * max(1, 3/2) * 1.0 = (50 + 60 + 240) * 1.5 = 350 * 1.5 = 525 MCU
      const estimate = estimateBlueprintStudioCost(6, 30, 3);
      expect(estimate.llmMCU).toBe(50);
      expect(estimate.audioMCU).toBe(60);
      expect(estimate.visualMCU).toBe(240);
      expect(estimate.totalMCU).toBe(525);
      expect(estimate.totalCostCents).toBe(53); // Math.round(525 / 10)
      expect(estimate.estimatedUsd).toBe(0.53);
      expect(estimate.isCeilingExceeded).toBe(false);
    });

    it('handles zero scenes and zero duration boundary without errors', () => {
      // Formula: (50 + 0 + 0) * max(1, 2/2) * 1.0 = 50 MCU
      const estimate = estimateBlueprintStudioCost(0, 0, 2);
      expect(estimate.llmMCU).toBe(50);
      expect(estimate.audioMCU).toBe(0);
      expect(estimate.visualMCU).toBe(0);
      expect(estimate.totalMCU).toBe(50);
      expect(estimate.totalCostCents).toBe(5);
      expect(estimate.estimatedUsd).toBe(0.05);
      expect(estimate.isCeilingExceeded).toBe(false);
    });

    it('flags spike cost ceiling exceeded when total cost > $5.00 (500 cents)', () => {
      // Extreme video: 100 scenes, 600s, 4 tracks
      // (50 + 1200 + 4000) * 2 = 5250 * 2 = 10,500 MCU = 1050 cents = $10.50
      const estimate = estimateBlueprintStudioCost(100, 600, 4);
      expect(estimate.totalCostCents).toBeGreaterThan(MAX_SINGLE_MISSION_COST_CENTS);
      expect(estimate.isCeilingExceeded).toBe(true);
      expect(estimate.totalCostCents).toBe(1050);
      expect(estimate.estimatedUsd).toBe(10.50);
    });

    it('applies 2.0x multiplier for 4k resolution', () => {
      const standard1080p = estimateBlueprintStudioCost(5, 30, 2, '1080p');
      const standard4k = estimateBlueprintStudioCost(5, 30, 2, '4k');

      expect(standard4k.totalMCU).toBe(standard1080p.totalMCU * 2);
    });

    it('supports premium model selection adjustments', () => {
      const defaultEstimate = estimateBlueprintStudioCost(5, 30, 2, '1080p');
      const premiumEstimate = estimateBlueprintStudioCost(5, 30, 2, '1080p', {
        llmModel: 'sonnet', // 100 MCU vs 50 MCU
        voiceModel: 'elevenlabs_clone', // 3 MCU/s vs 2 MCU/s
        visualModel: 'flux_pro', // 80 MCU/scene vs 40 MCU/scene
      });

      expect(premiumEstimate.llmMCU).toBe(100);
      expect(premiumEstimate.audioMCU).toBe(90);
      expect(premiumEstimate.visualMCU).toBe(400);
      expect(premiumEstimate.totalMCU).toBeGreaterThan(defaultEstimate.totalMCU);
    });
  });

  describe('calculateVideoMcuAndUsd', () => {
    it('correctly maps VideoCostParams object to calculation', () => {
      const res = calculateVideoMcuAndUsd({
        scenes: 4,
        durationSeconds: 20,
        trackCount: 2,
        resolution: '1080p',
      });

      // (50 + 40 + 160) * 1.0 = 250 MCU = 25 cents
      expect(res.totalMCU).toBe(250);
      expect(res.totalCostCents).toBe(25);
      expect(res.estimatedUsd).toBe(0.25);
      expect(res.isCeilingExceeded).toBe(false);
    });
  });
});

/**
 * @file thumbnail-saliency-engine.test.ts
 * @description Unit tests for Thumbnail Saliency & CTR Gaze Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import { evaluateThumbnailSaliency } from '../thumbnail-saliency-engine';

describe('Thumbnail Saliency Engine', () => {
  it('awards GRADE_A to high-contrast, face-prominent thumbnail', () => {
    const report = evaluateThumbnailSaliency({
      thumbnailId: 'thumb-viral-01',
      luminanceContrastRatio: 8.5,
      faceProminenceIndex: 0.9,
      colorSaturation: 0.85,
      ruleOfThirdsAdherence: 0.92,
      textOverlayAreaPct: 20,
    });

    expect(report.saliencyScore).toBeGreaterThanOrEqual(0.8);
    expect(report.gazeFixationGrade).toBe('GRADE_A');
    expect(report.predictedCtrPct).toBeGreaterThan(12.0);
    expect(report.recommendations[0]).toContain('chuẩn tối ưu');
  });

  it('applies penalty and yields corrective recommendations for cluttered thumbnail', () => {
    const report = evaluateThumbnailSaliency({
      thumbnailId: 'thumb-cluttered-02',
      luminanceContrastRatio: 3.2,
      faceProminenceIndex: 0.25,
      colorSaturation: 0.4,
      ruleOfThirdsAdherence: 0.45,
      textOverlayAreaPct: 55, // Severe clutter
    });

    expect(report.saliencyScore).toBeLessThan(0.5);
    expect(report.gazeFixationGrade).toBe('POOR');
    expect(report.recommendations.length).toBeGreaterThanOrEqual(3);
  });
});

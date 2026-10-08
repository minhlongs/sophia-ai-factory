/**
 * @file saliency-cropper-fsm.test.ts
 * @description Zero-mock unit tests for focal point saliency cropping and hook score evaluation
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import { calculateSaliencyCrop, evaluateSaliencyHookScore } from '../saliency-cropper-fsm';

describe('Saliency Cropper FSM', () => {
  it('correctly crops landscape 1920x1080 to 9:16 vertical based on focal point', () => {
    const crop = calculateSaliencyCrop({
      sourceWidth: 1920,
      sourceHeight: 1080,
      focalPointX: 0.8, // Face/subject on the right
      focalPointY: 0.5,
      targetFormat: 'TIKTOK_9_16',
    });

    expect(crop.cropHeight).toBe(1080);
    expect(crop.cropWidth).toBe(Math.round(1080 * (9 / 16))); // 608px
    expect(crop.cropX).toBeGreaterThan(1000); // Shifted right
    expect(crop.cropX + crop.cropWidth).toBeLessThanOrEqual(1920);
    expect(crop.cropY).toBe(0);
  });

  it('correctly crops landscape to 1:1 square centered', () => {
    const crop = calculateSaliencyCrop({
      sourceWidth: 1920,
      sourceHeight: 1080,
      focalPointX: 0.5,
      focalPointY: 0.5,
      targetFormat: 'SQUARE_FEED_1_1',
    });

    expect(crop.cropHeight).toBe(1080);
    expect(crop.cropWidth).toBe(1080);
    expect(crop.cropX).toBe(420);
    expect(crop.cropY).toBe(0);
  });

  it('evaluates hook score bounded between 0 and 100', () => {
    const high = evaluateSaliencyHookScore(50, 6);
    expect(high).toBe(100);

    const moderate = evaluateSaliencyHookScore(20, 3);
    expect(moderate).toBe(54);

    const low = evaluateSaliencyHookScore(0, 0);
    expect(low).toBe(0);
  });
});

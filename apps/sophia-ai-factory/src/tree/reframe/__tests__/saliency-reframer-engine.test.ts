/**
 * @file saliency-reframer-engine.test.ts
 * @description Unit tests for Saliency Re-Framer & Kinetic Subtitle Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import {
  computeSmoothedCropWindows,
  generateKineticSubtitleTokens,
} from '../saliency-reframer-engine';
import type { KeyframeFocalPoint } from '@/seed/types/growth-triad-v7-types';

describe('Saliency Re-Framer Engine', () => {
  it('smooths high-frequency focal jitter when converting 16:9 to 9:16', () => {
    const noisyKeyframes: KeyframeFocalPoint[] = [
      { timestampSec: 0, focalX: 0.5, focalY: 0.5, faceDetected: true },
      { timestampSec: 1, focalX: 0.8, focalY: 0.5, faceDetected: true }, // Sudden jump
      { timestampSec: 2, focalX: 0.2, focalY: 0.5, faceDetected: true }, // Reverse jump
      { timestampSec: 3, focalX: 0.5, focalY: 0.5, faceDetected: true },
    ];

    const { cropWindows, jitterScore } = computeSmoothedCropWindows(
      noisyKeyframes,
      '16:9',
      '9:16',
      0.85
    );

    expect(cropWindows).toHaveLength(4);
    expect(jitterScore).toBeLessThan(0.15); // Smoothed jitter is much less than raw jumps (~0.6)
    // Validate bounds
    cropWindows.forEach((cw) => {
      expect(cw.cropX).toBeGreaterThanOrEqual(0);
      expect(cw.cropX + cw.cropWidth).toBeLessThanOrEqual(1.0001);
    });
  });

  it('handles empty keyframe array without crashing', () => {
    const { cropWindows, jitterScore } = computeSmoothedCropWindows([], '16:9', '9:16');
    expect(cropWindows).toEqual([]);
    expect(jitterScore).toBe(0);
  });

  it('generates kinetic subtitle tokens with word timing and emphasis highlight', () => {
    const transcript = [
      {
        text: 'UNLOCK your potential with Sophia AI',
        startSec: 0.0,
        endSec: 3.0,
      },
    ];

    const tokens = generateKineticSubtitleTokens(transcript);
    expect(tokens).toHaveLength(6);
    expect(tokens[0].word).toBe('UNLOCK');
    expect(tokens[0].emphasis).toBe(true);
    expect(tokens[0].highlightColor).toBe('#fbbf24');
    expect(tokens[tokens.length - 1].endSec).toBeCloseTo(3.0, 1);
  });
});

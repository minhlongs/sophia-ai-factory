/**
 * @file saliency-cropper-fsm.ts
 * @description Pure deterministic engine for subject-aware saliency focal cropping and aspect transformation
 * @layer tree
 */

import type { RepurposeTargetFormat, SaliencyCropBox } from '@/seed/types/growth-triad-v4-types';

export interface SaliencyCalculationInput {
  sourceWidth: number;
  sourceHeight: number;
  focalPointX: number; // 0 to 1 normalized
  focalPointY: number; // 0 to 1 normalized
  targetFormat: RepurposeTargetFormat;
}

export function calculateSaliencyCrop(input: SaliencyCalculationInput): SaliencyCropBox {
  const { sourceWidth, sourceHeight, focalPointX, focalPointY, targetFormat } = input;

  let targetAspect = 9 / 16;
  if (targetFormat === 'SQUARE_FEED_1_1') {
    targetAspect = 1.0;
  }

  let cropWidth = sourceWidth;
  let cropHeight = Math.round(sourceWidth / targetAspect);

  if (cropHeight > sourceHeight) {
    cropHeight = sourceHeight;
    cropWidth = Math.round(sourceHeight * targetAspect);
  }

  // Calculate centered position around focal point
  const centerX = focalPointX * sourceWidth;
  const centerY = focalPointY * sourceHeight;

  let cropX = Math.round(centerX - cropWidth / 2);
  let cropY = Math.round(centerY - cropHeight / 2);

  // Clamp within source frame bounds
  cropX = Math.max(0, Math.min(cropX, sourceWidth - cropWidth));
  cropY = Math.max(0, Math.min(cropY, sourceHeight - cropHeight));

  const targetWidth = targetFormat === 'SQUARE_FEED_1_1' ? 1080 : 1080;
  const targetHeight = targetFormat === 'SQUARE_FEED_1_1' ? 1080 : 1920;

  return {
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
    focalPointX,
    focalPointY,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
  };
}

export function evaluateSaliencyHookScore(
  firstThreeSecondsMotionVariance: number,
  contrastRatio: number
): number {
  const motionScore = Math.min(60, firstThreeSecondsMotionVariance * 1.5);
  const contrastScore = Math.min(40, contrastRatio * 8);
  const total = Math.max(0, Math.min(100, motionScore + contrastScore));
  return Math.round(total * 10) / 10;
}

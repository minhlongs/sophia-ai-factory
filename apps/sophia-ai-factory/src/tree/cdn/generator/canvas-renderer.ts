/**
 * Aspect ratio parsing, validation, dimension presets, and crop/scale geometry.
 *
 * @module tree/cdn/generator/canvas-renderer
 */

import type {
  AspectRatio,
  ThumbnailFormat,
  ThumbnailResolutionTier,
} from '@/tree/cdn/types';
import {
  ASPECT_RATIOS,
  THUMBNAIL_FORMATS,
  ASPECT_RATIO_PRESETS,
} from '@/tree/cdn/types';
import type { CropAndScaleResult, DimensionsResult } from './types';

export function isValidAspectRatio(ratio: string): ratio is AspectRatio {
  return (ASPECT_RATIOS as readonly string[]).includes(ratio);
}

export function isValidThumbnailFormat(fmt: string): fmt is ThumbnailFormat {
  return (THUMBNAIL_FORMATS as readonly string[]).includes(fmt);
}

export function parseAspectRatioNumeric(ratio: AspectRatio): number {
  switch (ratio) {
    case '9:16':
      return 9 / 16;
    case '16:9':
      return 16 / 9;
    case '1:1':
      return 1;
    case '4:5':
      return 4 / 5;
  }
}

/**
 * Returns exact width & height for aspect ratio and tier.
 */
export function getDimensionsForAspectRatio(
  aspectRatio: AspectRatio,
  tier: ThumbnailResolutionTier = 'high',
): DimensionsResult {
  return ASPECT_RATIO_PRESETS[aspectRatio][tier];
}

/**
 * Calculates centered crop coordinates and scaling factors
 * to conform an arbitrary source image to a target aspect ratio.
 */
export function calculateCropAndScale(
  sourceWidth: number,
  sourceHeight: number,
  targetRatio: AspectRatio,
): CropAndScaleResult {
  const targetDims = getDimensionsForAspectRatio(targetRatio, 'high');

  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight)
  ) {
    return {
      cropX: 0,
      cropY: 0,
      cropWidth: targetDims.width,
      cropHeight: targetDims.height,
      targetWidth: targetDims.width,
      targetHeight: targetDims.height,
      scaleFactor: 1.0,
    };
  }

  const targetRatioNum = parseAspectRatioNumeric(targetRatio);
  const sourceRatioNum = sourceWidth / sourceHeight;

  let cropWidth = sourceWidth;
  let cropHeight = sourceHeight;
  let cropX = 0;
  let cropY = 0;

  if (Math.abs(sourceRatioNum - targetRatioNum) > 0.001) {
    if (sourceRatioNum > targetRatioNum) {
      cropWidth = Math.round(sourceHeight * targetRatioNum);
      cropHeight = sourceHeight;
      cropX = Math.round((sourceWidth - cropWidth) / 2);
      cropY = 0;
    } else {
      cropWidth = sourceWidth;
      cropHeight = Math.round(sourceWidth / targetRatioNum);
      cropX = 0;
      cropY = Math.round((sourceHeight - cropHeight) / 2);
    }
  }

  const scaleFactor = targetDims.width / cropWidth;

  return {
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    targetWidth: targetDims.width,
    targetHeight: targetDims.height,
    scaleFactor,
  };
}

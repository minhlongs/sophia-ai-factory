/**
 * @file saliency-reframer-engine.ts
 * @description Pure algorithmic engine for Saliency-Based Video Re-Framing & Kinetic Subtitles
 * @layer tree
 */

import type {
  AspectRatio,
  KeyframeFocalPoint,
  CropWindow,
  KineticSubtitleToken,
} from '@/seed/types/growth-triad-v7-types';

const ASPECT_RATIOS: Record<AspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1.0,
  '4:5': 4 / 5,
};

/**
 * Computes exponentially smoothed crop windows for multi-aspect conversion
 */
export function computeSmoothedCropWindows(
  keyframes: KeyframeFocalPoint[],
  sourceAspect: AspectRatio = '16:9',
  targetAspect: AspectRatio = '9:16',
  alpha = 0.85
): { cropWindows: CropWindow[]; jitterScore: number } {
  if (keyframes.length === 0) {
    return { cropWindows: [], jitterScore: 0 };
  }

  const srcRatio = ASPECT_RATIOS[sourceAspect];
  const tgtRatio = ASPECT_RATIOS[targetAspect];

  let cropWidth = 1.0;
  let cropHeight = 1.0;

  if (tgtRatio < srcRatio) {
    // Narrower aspect (e.g. 16:9 -> 9:16)
    cropWidth = Math.min(1.0, tgtRatio / srcRatio);
    cropHeight = 1.0;
  } else {
    // Wider aspect
    cropWidth = 1.0;
    cropHeight = Math.min(1.0, srcRatio / tgtRatio);
  }

  let smoothedX = keyframes[0].focalX;
  const cropWindows: CropWindow[] = [];
  let totalDelta = 0;

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    // Exponential smoothing filter
    smoothedX = alpha * smoothedX + (1 - alpha) * kf.focalX;

    // Clamp crop bounds so crop window stays inside frame [0, 1]
    const halfW = cropWidth / 2;
    const clampedCenterX = Math.max(halfW, Math.min(1 - halfW, smoothedX));
    const cropX = clampedCenterX - halfW;
    const cropY = (1 - cropHeight) / 2;

    if (i > 0) {
      totalDelta += Math.abs(clampedCenterX - (cropWindows[i - 1].cropX + halfW));
    }

    cropWindows.push({
      timestampSec: kf.timestampSec,
      cropX: Number(cropX.toFixed(4)),
      cropY: Number(cropY.toFixed(4)),
      cropWidth: Number(cropWidth.toFixed(4)),
      cropHeight: Number(cropHeight.toFixed(4)),
    });
  }

  const jitterScore =
    keyframes.length > 1 ? Number((totalDelta / (keyframes.length - 1)).toFixed(4)) : 0;

  return { cropWindows, jitterScore };
}

/**
 * Generates kinetic subtitle tokens with word timing and emphasis styling
 */
export function generateKineticSubtitleTokens(
  rawTranscript: Array<{ text: string; startSec: number; endSec: number }>
): KineticSubtitleToken[] {
  const tokens: KineticSubtitleToken[] = [];

  for (const segment of rawTranscript) {
    const words = segment.text.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const durationPerWord = (segment.endSec - segment.startSec) / words.length;

    words.forEach((word, idx) => {
      const cleanWord = word.replace(/[^a-zA-Z0-9]/g, '');
      const isEmphasis =
        cleanWord.length >= 6 || word === word.toUpperCase() && cleanWord.length > 1;

      tokens.push({
        word,
        startSec: Number((segment.startSec + idx * durationPerWord).toFixed(2)),
        endSec: Number((segment.startSec + (idx + 1) * durationPerWord).toFixed(2)),
        emphasis: isEmphasis,
        highlightColor: isEmphasis ? '#fbbf24' : '#ffffff',
      });
    });
  }

  return tokens;
}

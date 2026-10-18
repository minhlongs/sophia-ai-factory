/**
 * B-Roll Matcher & Visual Timeline Synthesizer.
 * Analyzes script text, sentiment, and pacing to generate high-retention video cues.
 */

import { getAssetsByNiche } from './broll-asset-registry';
import type { BRollCue, BRollMatchRequest, BRollMatchResult } from './broll-types';
import { MOTION_ROTATION, detectSliceCategory } from './broll-keyword-map';

export function matchBRollTimeline(request: BRollMatchRequest): BRollMatchResult {
  const {
    niche,
    totalDurationSeconds,
    scriptText,
    targetCutIntervalSeconds = 2.5,
  } = request;

  const availableAssets = getAssetsByNiche(niche);
  const words = scriptText.toLowerCase().split(/\s+/);
  const totalCuts = Math.max(1, Math.ceil(totalDurationSeconds / targetCutIntervalSeconds));
  const cutDuration = totalDurationSeconds / totalCuts;

  const cues: BRollCue[] = [];

  for (let i = 0; i < totalCuts; i++) {
    const startTime = Number((i * cutDuration).toFixed(2));
    const endTime = Number(Math.min(totalDurationSeconds, (i + 1) * cutDuration).toFixed(2));
    const duration = Number((endTime - startTime).toFixed(2));

    // Sample words in this time slice
    const wordSliceStart = Math.floor((i / totalCuts) * words.length);
    const wordSliceEnd = Math.floor(((i + 1) / totalCuts) * words.length);
    const sliceWords = words.slice(wordSliceStart, Math.max(wordSliceStart + 1, wordSliceEnd));

    // Find category from keyword match or fallback
    const detectedCategory = detectSliceCategory(sliceWords, niche, i);

    // Match best asset
    const matchingAsset =
      availableAssets.find((a) => a.category === detectedCategory) ||
      availableAssets[i % availableAssets.length];

    const motionStyle =
      matchingAsset?.recommendedMotion ||
      MOTION_ROTATION[i % MOTION_ROTATION.length];

    const promptFallback = `Cinematic 9:16 vertical 4k render of ${detectedCategory.replace(/_/g, ' ')}, hyper-detailed lighting, sleek cyber aesthetic`;

    cues.push({
      assetId: matchingAsset ? matchingAsset.id : `ai-gen-${detectedCategory}-${i}`,
      category: detectedCategory,
      assetUrl: matchingAsset ? matchingAsset.url : '',
      startTimeSeconds: startTime,
      endTimeSeconds: endTime,
      durationSeconds: duration,
      motionStyle,
      promptFallback,
      overlayOpacity: 0.9,
    });
  }

  const coveredDuration = cues.reduce((sum, c) => sum + c.durationSeconds, 0);
  const coveragePercentage = Number(
    Math.min(100, (coveredDuration / totalDurationSeconds) * 100).toFixed(1)
  );

  return {
    niche,
    cues,
    totalCues: cues.length,
    averageCutDuration: Number(cutDuration.toFixed(2)),
    coveragePercentage,
  };
}

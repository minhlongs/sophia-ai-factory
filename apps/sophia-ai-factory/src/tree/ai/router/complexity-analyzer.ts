/**
 * Multimodal Complexity Analyzer & Resource Estimator
 *
 * Layer: tree/ai/router
 */

import type { VideoPipelineSpec } from '@/seed/types/unit-economics-types';

export interface PipelineComplexityAnalysis {
  durationSeconds: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  frameCount: number;
  characterCount: number;
  tokenDensityPerSecond: number;
  frameRatePerSecond: number;
}

/**
 * Derives normalized resource demand and token density from pipeline specification.
 */
export function analyzePipelineComplexity(spec: VideoPipelineSpec): PipelineComplexityAnalysis {
  const duration = Math.max(1, spec.targetDurationSeconds);
  const promptTokens = spec.scriptPromptTokens ?? 1200;
  const completionTokens = spec.scriptCompletionTokens ?? 400;
  const totalTokens = promptTokens + completionTokens;
  const frameCount = spec.frameCount ?? Math.max(1, Math.ceil(duration / 5));
  const characterCount = spec.audioCharacterCount ?? Math.round(duration * 14);

  return {
    durationSeconds: duration,
    promptTokens,
    completionTokens,
    totalTokens,
    frameCount,
    characterCount,
    tokenDensityPerSecond: Number((totalTokens / duration).toFixed(2)),
    frameRatePerSecond: Number((frameCount / duration).toFixed(2)),
  };
}

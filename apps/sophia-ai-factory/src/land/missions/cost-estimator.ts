/**
 * Pre-flight Cost & Latency Estimator for First-Run Missions.
 * Provides 100% transparent pricing in USD and MCU credits with zero hidden fees.
 *
 * @module land/missions/cost-estimator
 */

import { type TemplateId, getTemplateById, getDefaultTemplate } from './first-run-template';
import { VIDEO_MCU_COSTS } from '@/land/billing/video-mcu-cost-config';
import {
  FAL_AI_COST_PER_IMAGE_USD,
  ELEVENLABS_COST_PER_1K_CHARS_USD,
  OPENROUTER_SCRIPT_COST_USD,
  CHARS_PER_WORD_RATIO,
  STANDARD_STAGES,
  type CostBreakdownItem,
  type StageLatencyEstimate,
  type MissionPreflightEstimate,
} from './cost-estimator-config';

export {
  FAL_AI_COST_PER_IMAGE_USD,
  ELEVENLABS_COST_PER_1K_CHARS_USD,
  OPENROUTER_SCRIPT_COST_USD,
  CHARS_PER_WORD_RATIO,
};

export type {
  CostBreakdownItem,
  StageLatencyEstimate,
  MissionPreflightEstimate,
};

/**
 * Calculate MCU credits scaled by video duration.
 * Caps at standard VIDEO_MCU_COSTS.VIDEO_CREATE (50 MCU).
 */
export function calculateMcuCredits(durationSeconds: number): number {
  if (durationSeconds <= 30) return 30;
  if (durationSeconds <= 45) return 40;
  return VIDEO_MCU_COSTS.VIDEO_CREATE; // 50 MCU
}

/**
 * Estimate transparent cost and duration for any mission parameters.
 */
export function estimateMissionPreflight(input: {
  durationSeconds: number;
  estimatedScenes: number;
  targetWordCount: number;
}): MissionPreflightEstimate {
  const scenes = Math.max(1, input.estimatedScenes);
  const words = Math.max(10, input.targetWordCount);

  // 1. fal.ai visual generation cost
  const visualUsd = Number((scenes * FAL_AI_COST_PER_IMAGE_USD).toFixed(4));

  // 2. ElevenLabs voice synthesis cost
  const estimatedChars = Math.round(words * CHARS_PER_WORD_RATIO);
  const voiceUsd = Number(((estimatedChars / 1000) * ELEVENLABS_COST_PER_1K_CHARS_USD).toFixed(4));

  // 3. OpenRouter script generation cost
  const scriptUsd = OPENROUTER_SCRIPT_COST_USD;

  // Total USD rounded to 3 decimals
  const totalUsd = Number((visualUsd + voiceUsd + scriptUsd).toFixed(3));
  const totalMcu = calculateMcuCredits(input.durationSeconds);

  const breakdown: CostBreakdownItem[] = [
    {
      service: 'fal.ai',
      category: 'visual',
      unitMetric: `${scenes} scenes (${scenes} AI images)`,
      estimatedUsd: visualUsd,
    },
    {
      service: 'ElevenLabs',
      category: 'voice',
      unitMetric: `${estimatedChars} chars (~${words} words)`,
      estimatedUsd: voiceUsd,
    },
    {
      service: 'OpenRouter',
      category: 'script',
      unitMetric: '1 script (~800 prompt/completion tokens)',
      estimatedUsd: scriptUsd,
    },
  ];

  return {
    totalUsd,
    totalMcu,
    durationRangeSeconds: {
      min: 45,
      max: 90,
    },
    breakdown,
    stages: STANDARD_STAGES,
    isZeroHiddenFees: true,
  };
}

/**
 * Estimate preflight cost for a given starter template.
 */
export function estimateTemplateCost(templateId: TemplateId): MissionPreflightEstimate {
  const template = getTemplateById(templateId) ?? getDefaultTemplate();
  return estimateMissionPreflight({
    durationSeconds: template.durationSeconds,
    estimatedScenes: template.estimatedScenes,
    targetWordCount: template.targetWordCount,
  });
}

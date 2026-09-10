/**
 * Pre-flight Cost & Latency Estimator for First-Run Missions.
 * Provides 100% transparent pricing in USD and MCU credits with zero hidden fees.
 *
 * @module land/missions/cost-estimator
 */

import { type TemplateId, getTemplateById, getDefaultTemplate } from './first-run-template';
import { VIDEO_MCU_COSTS } from '@/land/billing/video-mcu-cost-config';

// ── Rate Constants (Live AI Provider Pricing) ──────────────────────────────
export const FAL_AI_COST_PER_IMAGE_USD = 0.025;
export const ELEVENLABS_COST_PER_1K_CHARS_USD = 0.015;
export const OPENROUTER_SCRIPT_COST_USD = 0.005;
export const CHARS_PER_WORD_RATIO = 5.5;

export interface CostBreakdownItem {
  service: 'fal.ai' | 'ElevenLabs' | 'OpenRouter';
  category: 'visual' | 'voice' | 'script';
  unitMetric: string;
  estimatedUsd: number;
}

export interface StageLatencyEstimate {
  stageId: string;
  labelEn: string;
  labelVi: string;
  minSeconds: number;
  maxSeconds: number;
}

export interface MissionPreflightEstimate {
  totalUsd: number;
  totalMcu: number;
  durationRangeSeconds: {
    min: number;
    max: number;
  };
  breakdown: CostBreakdownItem[];
  stages: StageLatencyEstimate[];
  isZeroHiddenFees: true;
}

/** Stage latency breakdown representing standard pipeline benchmarks */
const STANDARD_STAGES: StageLatencyEstimate[] = [
  {
    stageId: 'SCRIPT_GENERATION',
    labelEn: 'Script Generation',
    labelVi: 'Soạn kịch bản SEO',
    minSeconds: 5,
    maxSeconds: 10,
  },
  {
    stageId: 'VOICE_SYNTHESIS',
    labelEn: 'Voice Synthesis',
    labelVi: 'Lồng tiếng AI',
    minSeconds: 8,
    maxSeconds: 15,
  },
  {
    stageId: 'VISUAL_GENERATION',
    labelEn: 'Visual Generation',
    labelVi: 'Tạo hình ảnh AI',
    minSeconds: 15,
    maxSeconds: 35,
  },
  {
    stageId: 'VIDEO_COMPOSITING',
    labelEn: 'Video Compositing',
    labelVi: 'Ghép video & phụ đề',
    minSeconds: 17,
    maxSeconds: 30,
  },
  {
    stageId: 'READY_FOR_REVIEW',
    labelEn: 'Ready for Review',
    labelVi: 'Sẵn sàng duyệt',
    minSeconds: 0,
    maxSeconds: 0,
  },
];

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

/**
 * Rate Constants, Stage Benchmarks & Types for Mission Preflight Cost Estimator.
 *
 * @module land/missions/cost-estimator-config
 */

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
export const STANDARD_STAGES: StageLatencyEstimate[] = [
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

/**
 * Pre-Flight Cost Engine for Video Blueprint Instantiation
 *
 * Layer: tree (pure domain logic and calculations)
 * Dependencies: @/seed/types/creator-marketplace
 *
 * @module tree/marketplace/preflight-cost-engine
 */

import type {
  VideoCostParams,
  PreflightCostEstimate,
} from '@/seed/types/creator-marketplace';

export const MAX_SINGLE_MISSION_COST_CENTS = 500; // $5.00 spike protection ceiling
export const MCU_PER_CENT = 10; // 10 MCU = 1 cent USD ($0.01)

/**
 * Computes live pre-flight MCU and USD cost for a video blueprint or studio mission.
 *
 * Baseline Rates:
 * - LLM Script Generation: 50 MCU (5¢)
 * - Audio Narration (TTS): 2 MCU per second
 * - Visual Generation: 40 MCU per scene
 * - Track Multiplier: max(1, trackCount / 2)
 * - Resolution Multiplier: 4k = 2.0x, 1080p = 1.0x, 720p = 1.0x
 * - Ceiling: > 500 cents ($5.00 / 5,000 MCU) flags isCeilingExceeded = true
 */
export function estimateBlueprintStudioCost(
  scenes = 5,
  durationSeconds = 30,
  trackCount = 3,
  resolution: '720p' | '1080p' | '4k' = '1080p',
  modelSelection?: VideoCostParams['modelSelection'],
): PreflightCostEstimate {
  // Normalize non-negative inputs
  const safeScenes = Math.max(0, Math.floor(scenes));
  const safeDuration = Math.max(0, Math.floor(durationSeconds));
  const safeTracks = Math.max(1, Math.floor(trackCount));

  // 1. LLM Script Generation
  let llmRate = 50;
  if (modelSelection?.llmModel === 'sonnet' || modelSelection?.llmModel === 'gpt-4o') {
    llmRate = 100;
  }
  const llmMCU = llmRate;

  // 2. Audio Narration
  let audioRate = 2; // 2 MCU/sec standard ElevenLabs
  if (modelSelection?.voiceModel === 'elevenlabs_clone') {
    audioRate = 3;
  }
  const audioMCU = Math.round(safeDuration * audioRate);

  // 3. Visual Scene Generation
  let visualRate = 40; // 40 MCU/scene Flux Schnell
  if (modelSelection?.visualModel === 'flux_dev') {
    visualRate = 50;
  } else if (modelSelection?.visualModel === 'flux_pro') {
    visualRate = 80;
  }
  const visualMCU = safeScenes * visualRate;

  // 4. Multipliers
  const trackMultiplier = Math.max(1, safeTracks / 2);
  const resMultiplier = resolution === '4k' ? 2.0 : 1.0;

  const totalMCU = Math.round((llmMCU + audioMCU + visualMCU) * trackMultiplier * resMultiplier);
  const totalCostCents = Math.round(totalMCU / MCU_PER_CENT);
  const estimatedUsd = totalCostCents / 100;
  const isCeilingExceeded = totalCostCents > MAX_SINGLE_MISSION_COST_CENTS;

  return {
    audioMCU,
    visualMCU,
    llmMCU,
    totalMCU,
    totalCostCents,
    estimatedUsd,
    isCeilingExceeded,
  };
}

/**
 * Calculates raw MCU and USD cents from explicit component params.
 */
export function calculateVideoMcuAndUsd(params: VideoCostParams): PreflightCostEstimate {
  return estimateBlueprintStudioCost(
    params.scenes ?? 5,
    params.durationSeconds ?? 30,
    params.trackCount ?? 3,
    params.resolution ?? '1080p',
    params.modelSelection,
  );
}

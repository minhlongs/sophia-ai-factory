/**
 * Video Production Cost Engine
 *
 * Calculates EXACT operational costs for AI video production.
 * Uses real API pricing from HeyGen, ElevenLabs, OpenRouter.
 * Computes throughput capacity and ROI/ARR projections.
 */

import {
  API_COSTS,
  INFRA_COSTS,
  MONTHLY_INFRA_COST,
  PRODUCTION_LIMITS,
} from './video-production-cost-constants';
import {
  calculateTierROI,
  calculateARRProjection,
} from './video-production-projections';

export type {
  CostBreakdown,
  ThroughputResult,
  ROIProjection,
  ARRProjection,
} from './video-production-cost-constants';

export {
  API_COSTS,
  INFRA_COSTS,
  MONTHLY_INFRA_COST,
  PRODUCTION_LIMITS,
  calculateTierROI,
  calculateARRProjection,
};

/**
 * Calculate variable cost per video (API costs only).
 */
export function calculateVariableCost(durationMin: number = 1): { heygen: number; elevenlabs: number; openrouter: number } {
  return {
    heygen: API_COSTS.heygen.perMinute * durationMin,
    elevenlabs: API_COSTS.elevenlabs.perScript,
    openrouter: API_COSTS.openrouter.perScript,
  };
}

/**
 * Calculate full cost breakdown for a given monthly volume.
 * Includes API subscriptions + cloud infrastructure.
 */
export function calculateCostBreakdown(videosPerMonth: number, durationMin: number = 1) {
  const components = calculateVariableCost(durationMin);
  const variableCostPerVideo = components.heygen + components.elevenlabs + components.openrouter;

  const monthlyFixedCosts =
    API_COSTS.heygen.monthlyFixed +
    API_COSTS.elevenlabs.monthlyFixed +
    API_COSTS.openrouter.monthlyFixed +
    MONTHLY_INFRA_COST;

  const fixedPerVideo = videosPerMonth > 0 ? monthlyFixedCosts / videosPerMonth : 0;
  const totalCostPerVideo = variableCostPerVideo + fixedPerVideo;

  return { variableCostPerVideo, monthlyFixedCosts, totalCostPerVideo, components };
}

/**
 * Calculate maximum production throughput.
 */
export function calculateThroughput(
  parallelJobs: number = PRODUCTION_LIMITS.maxParallelJobs,
  processingTimeMin: number = PRODUCTION_LIMITS.processingTimeMin,
) {
  const videosPerHour = Math.floor((60 / processingTimeMin) * parallelJobs);
  const videosPerDay = videosPerHour * PRODUCTION_LIMITS.operatingHoursPerDay;
  const videosPerMonth = videosPerDay * 30;
  const videosPerYear = videosPerDay * 365;

  return { videosPerHour, videosPerDay, videosPerMonth, videosPerYear };
}

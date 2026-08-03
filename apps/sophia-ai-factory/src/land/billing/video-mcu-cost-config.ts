/**
 * Video MCU (Metered Credit Unit) Cost Configuration
 * Maps video pipeline operations to credit costs for unified billing.
 */

export const VIDEO_MCU_COSTS = {
  VIDEO_CREATE: 50,      // 1 full video generation = 50 MCU
  SCRIPT_ONLY: 5,        // Script generation without video = 5 MCU
  VOICEOVER_ONLY: 10,    // TTS without video = 10 MCU
} as const;

export type VideoOperation = keyof typeof VIDEO_MCU_COSTS;

export function getVideoCost(operation: VideoOperation): number {
  return VIDEO_MCU_COSTS[operation];
}

/** Billing telemetry event names emitted alongside cost lookups. */
export const BILLING_TELEMETRY_EVENTS = {
  VIDEO_COST_LOOKUP: 'billing.video_cost_lookup',
  PROPOSAL_COST_LOOKUP: 'billing.proposal_cost_lookup',
  OVERAGE_ESTIMATE: 'billing.overage_estimate',
} as const;

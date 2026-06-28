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

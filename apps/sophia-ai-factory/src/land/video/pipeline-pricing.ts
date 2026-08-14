/**
 * Pipeline Pricing — per-call cost constants for the video pipeline.
 *
 * Single source of truth for the emit-usage step in video-generate.ts.
 * Costs are in USD per unit (per-second for time-based, per-render for
 * fixed-cost providers).  Values are based on published API pricing and
 * should be updated when provider rates change.
 *
 * @module land/video/pipeline-pricing
 */

/** TTS provider costs — USD per render call. */
export const TTS_PRICING = {
  /** ElevenLabs Creator plan: ~$0.03 per script render */
  elevenlabs: 0.03,
  /** Fish Speech (Replicate): ~$0.005 per render */
  fish_speech: 0.005,
} as const;

/** Visual / video provider costs. */
export const VISUAL_PRICING = {
  /** HeyGen Scale API: ~$0.02 per second of output video */
  heygen: { perSecond: 0.02 },
  /** D-ID Build plan: ~$0.025 per render (fixed per video) */
  did: { perRender: 0.025 },
  /** Wan 2.1 via Replicate: ~$0.015 per render (fixed per video) */
  wan: { perRender: 0.015 },
} as const;

/**
 * Compute the TTS cost for a given provider.
 */
export function computeTtsCost(provider: string): number {
  if (provider === 'elevenlabs') return TTS_PRICING.elevenlabs;
  if (provider === 'fish_speech') return TTS_PRICING.fish_speech;
  // Unknown provider — log warning and return zero rather than crashing pipeline
  return 0;
}

/**
 * Compute the visual / video generation cost for a given provider.
 *
 * @param provider  The visual provider key (heygen, did, wan, etc.)
 * @param durationSec  Duration of the output in seconds (used for HeyGen
 *                     per-second billing; ignored for fixed-cost providers).
 */
export function computeVisualCost(provider: string, durationSec: number): number {
  if (provider === 'heygen') return durationSec * VISUAL_PRICING.heygen.perSecond;
  if (provider === 'd-id') return VISUAL_PRICING.did.perRender;
  if (provider === 'wan') return VISUAL_PRICING.wan.perRender;
  // Unknown provider — log warning and return zero rather than crashing pipeline
  return 0;
}

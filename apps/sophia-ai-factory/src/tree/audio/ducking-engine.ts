/**
 * @file ducking-engine.ts
 * @description Dynamic audio ducking and BPM tempo alignment engine
 * @layer tree
 */

import type { ViralSoundTrack } from '@/seed/types/viral-expansion-types';

export interface DuckingEnvelopeSegment {
  timeSec: number;
  gainDb: number;
  fadeDurationMs: number;
}

export interface DuckingCalculationResult {
  duckingDb: number;
  fadeDurationMs: number;
  segments: DuckingEnvelopeSegment[];
  bpmDifferenceRatio: number;
  isTempoAligned: boolean;
}

/**
 * Calculates audio ducking envelope during voiceover segments.
 * Default standard: -14dB attenuation with 120ms logarithmic ramp.
 */
export function calculateDuckingEnvelope(
  voiceoverWindows: Array<{ startSec: number; endSec: number }>,
  duckingDb: number = -14,
  fadeDurationMs: number = 120,
): DuckingEnvelopeSegment[] {
  const boundedDb = Math.max(-30, Math.min(-6, duckingDb));
  const segments: DuckingEnvelopeSegment[] = [];

  for (const window of voiceoverWindows) {
    segments.push({
      timeSec: Math.max(0, window.startSec - fadeDurationMs / 1000),
      gainDb: boundedDb,
      fadeDurationMs,
    });
    segments.push({
      timeSec: window.endSec,
      gainDb: 0,
      fadeDurationMs,
    });
  }

  return segments;
}

/**
 * Evaluates BPM alignment between video cut rhythm and background music.
 */
export function evaluateBpmTempoAlignment(
  videoTargetBpm: number,
  soundTrack: ViralSoundTrack,
): { bpmDifferenceRatio: number; isTempoAligned: boolean; suggestedSpeedMultiplier: number } {
  const diff = Math.abs(soundTrack.bpm - videoTargetBpm);
  const ratio = Number((diff / videoTargetBpm).toFixed(3));
  const isAligned = ratio <= 0.12;
  const rawMultiplier = videoTargetBpm / soundTrack.bpm;
  const boundedMultiplier = Number(Math.max(0.9, Math.min(1.15, rawMultiplier)).toFixed(2));

  return {
    bpmDifferenceRatio: ratio,
    isTempoAligned: isAligned,
    suggestedSpeedMultiplier: boundedMultiplier,
  };
}

/**
 * @file audio-resonance-engine.ts
 * @description Pure algorithmic engine for Audio Beat-Drop Quantization & Resonance Scoring
 * @layer tree
 */

import type {
  AudioBeatInput,
  AudioResonanceOutput,
  AudioDuckingMarker,
} from '@/seed/types/growth-triad-v8-types';

/**
 * Quantizes cut timestamps to nearest audio beat drops and computes resonance index
 */
export function computeAudioResonance(input: AudioBeatInput): AudioResonanceOutput {
  const sortedBeats = [...input.beatTimestampsSec].sort((a, b) => a - b);
  const quantizedCuts: number[] = [];
  let snappedCount = 0;

  for (const cut of input.candidateCutTimestampsSec) {
    if (sortedBeats.length === 0) {
      quantizedCuts.push(cut);
      continue;
    }

    // Find closest beat
    let closestBeat = sortedBeats[0];
    let minDiff = Math.abs(cut - closestBeat);

    for (const beat of sortedBeats) {
      const diff = Math.abs(cut - beat);
      if (diff < minDiff) {
        minDiff = diff;
        closestBeat = beat;
      }
    }

    // If within 150ms window, snap to beat
    if (minDiff <= 0.15) {
      quantizedCuts.push(Number(closestBeat.toFixed(3)));
      snappedCount++;
    } else {
      quantizedCuts.push(cut);
    }
  }

  const syncRatio = input.candidateCutTimestampsSec.length > 0
    ? snappedCount / input.candidateCutTimestampsSec.length
    : 1.0;

  // Emotional valence-arousal harmonic score
  const emotionHarmonic = (input.arousalScore * 0.6 + input.valenceScore * 0.4);

  // BPM normalization (optimal high-energy cadence is between 120 and 140 BPM)
  const bpmFactor = Math.min(1.0, Math.max(0.6, input.bpm / 130));

  const rawScore = syncRatio * 50 + emotionHarmonic * 35 + bpmFactor * 15;
  const resonanceScore = Number(Math.min(100, Math.max(10, rawScore)).toFixed(1));

  let syncQuality: 'PERFECT' | 'HIGH' | 'FAIR';
  if (syncRatio >= 0.85) {
    syncQuality = 'PERFECT';
  } else if (syncRatio >= 0.5) {
    syncQuality = 'HIGH';
  } else {
    syncQuality = 'FAIR';
  }

  // Generate ducking markers 100ms before and 200ms after each quantized cut
  const duckingMarkers: AudioDuckingMarker[] = quantizedCuts.map((cut) => ({
    startSec: Number(Math.max(0, cut - 0.1).toFixed(3)),
    endSec: Number(Math.min(input.durationSec, cut + 0.2).toFixed(3)),
    targetDuckingDb: -6.0,
  }));

  return {
    audioTrackId: input.audioTrackId,
    resonanceScore,
    quantizedCutTimestampsSec: quantizedCuts,
    duckingMarkers,
    syncQuality,
  };
}

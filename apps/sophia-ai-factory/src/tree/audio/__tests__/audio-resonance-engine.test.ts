/**
 * @file audio-resonance-engine.test.ts
 * @description Unit tests for Audio Beat-Drop Quantization & Resonance Scoring Engine
 * @layer tree
 */

import { describe, it, expect } from 'vitest';
import { computeAudioResonance } from '../audio-resonance-engine';
import type { AudioBeatInput } from '@/seed/types/growth-triad-v8-types';

describe('Audio Resonance Engine (Pillar 1)', () => {
  it('snaps candidate cuts within tolerance to nearest beat timestamps', () => {
    const input: AudioBeatInput = {
      audioTrackId: 'track-edm-128',
      bpm: 128,
      durationSec: 30,
      beatTimestampsSec: [1.0, 2.0, 3.0, 4.0],
      arousalScore: 0.9,
      valenceScore: 0.85,
      candidateCutTimestampsSec: [0.95, 2.08, 2.8, 4.02],
    };

    const res = computeAudioResonance(input);

    expect(res.audioTrackId).toBe('track-edm-128');
    expect(res.quantizedCutTimestampsSec[0]).toBe(1.0);
    expect(res.quantizedCutTimestampsSec[1]).toBe(2.0);
    expect(res.quantizedCutTimestampsSec[3]).toBe(4.0);
    expect(res.syncQuality).toBe('HIGH');
    expect(res.resonanceScore).toBeGreaterThan(70);
  });

  it('marks syncQuality as PERFECT when all cuts align to beats', () => {
    const input: AudioBeatInput = {
      audioTrackId: 'track-trap-140',
      bpm: 140,
      durationSec: 15,
      beatTimestampsSec: [1.0, 2.0, 3.0],
      arousalScore: 0.95,
      valenceScore: 0.9,
      candidateCutTimestampsSec: [1.02, 1.98, 3.01],
    };

    const res = computeAudioResonance(input);

    expect(res.syncQuality).toBe('PERFECT');
    expect(res.resonanceScore).toBeGreaterThan(85);
    expect(res.duckingMarkers).toHaveLength(3);
    expect(res.duckingMarkers[0].targetDuckingDb).toBe(-6.0);
  });

  it('handles empty beat timestamps gracefully without crashing', () => {
    const input: AudioBeatInput = {
      audioTrackId: 'track-silent',
      bpm: 90,
      durationSec: 10,
      beatTimestampsSec: [],
      arousalScore: 0.2,
      valenceScore: 0.3,
      candidateCutTimestampsSec: [2.5, 5.0],
    };

    const res = computeAudioResonance(input);

    expect(res.quantizedCutTimestampsSec).toEqual([2.5, 5.0]);
    expect(res.syncQuality).toBe('FAIR');
  });
});

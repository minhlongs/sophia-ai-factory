/**
 * @file ducking-engine.test.ts
 * @description Unit tests for Ducking Engine and BPM Tempo Alignment
 */

import { describe, it, expect } from 'vitest';
import { calculateDuckingEnvelope, evaluateBpmTempoAlignment } from '@/tree/audio/ducking-engine';
import type { ViralSoundTrack } from '@/seed/types/viral-expansion-types';

describe('DuckingEngine', () => {
  it('calculates proper ducking envelope segments for voiceover windows', () => {
    const windows = [
      { startSec: 1.0, endSec: 5.0 },
      { startSec: 7.0, endSec: 10.0 },
    ];

    const segments = calculateDuckingEnvelope(windows, -14, 120);

    expect(segments).toHaveLength(4);
    expect(segments[0].gainDb).toBe(-14);
    expect(segments[0].timeSec).toBeCloseTo(1.0 - 0.12, 2);
    expect(segments[1].gainDb).toBe(0);
    expect(segments[1].timeSec).toBe(5.0);
  });

  it('clamps extreme ducking dB values between -30dB and -6dB', () => {
    const windows = [{ startSec: 1.0, endSec: 2.0 }];

    const tooQuiet = calculateDuckingEnvelope(windows, -50, 100);
    expect(tooQuiet[0].gainDb).toBe(-30);

    const tooLoud = calculateDuckingEnvelope(windows, -2, 100);
    expect(tooLoud[0].gainDb).toBe(-6);
  });

  it('evaluates BPM alignment and speed scaling properly', () => {
    const mockTrack: ViralSoundTrack = {
      id: 'sound_1',
      title: 'Synthwave Pulse',
      artist: 'Aero',
      bpm: 120,
      audioUrl: 'https://example.com/audio.mp3',
      viralityIndex: 85,
      copyrightTier: 'ROYALTY_FREE_SAFE',
      recommendedDuckingDb: -14,
      platformTags: ['edm'],
    };

    const aligned = evaluateBpmTempoAlignment(125, mockTrack);
    expect(aligned.isTempoAligned).toBe(true);
    expect(aligned.bpmDifferenceRatio).toBeCloseTo(0.04, 2);
    expect(aligned.suggestedSpeedMultiplier).toBe(1.04);

    const misaligned = evaluateBpmTempoAlignment(160, mockTrack);
    expect(misaligned.isTempoAligned).toBe(false);
    expect(misaligned.suggestedSpeedMultiplier).toBe(1.15); // capped at 1.15
  });
});

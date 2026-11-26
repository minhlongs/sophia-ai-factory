/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  buildKaraokeWordCues,
  detectWebCodecsBrowserSupport,
  evaluateFrameStateAtIndex,
} from '../webcodecs-timeline-spec';

describe('WebCodecs Frame-Pure Timeline & Karaoke Caption Spec', () => {
  const scenes = [
    { sceneNumber: 1, narration: 'Build crypto affiliate videos fast', durationSec: 5 },
    { sceneNumber: 2, narration: 'Zero server GPU cost', durationSec: 4 },
  ] as const;

  it('generates deterministic word-level karaoke cues across scenes', () => {
    const cues = buildKaraokeWordCues(scenes);
    expect(cues).toHaveLength(9);
    expect(cues[0]).toEqual({ word: 'Build', startSec: 0, endSec: 1, sceneNumber: 1 });
    expect(cues[5]).toEqual({ word: 'Zero', startSec: 5, endSec: 6, sceneNumber: 2 });
  });

  it('evaluates frame-pure Ken Burns zoom and active karaoke word deterministically', () => {
    const cues = buildKaraokeWordCues(scenes);
    const frame0 = evaluateFrameStateAtIndex(scenes, cues, 0, 30);
    const frame75 = evaluateFrameStateAtIndex(scenes, cues, 75, 30); // t = 2.5s (50% of scene 1)

    expect(frame0.kenBurnsScale).toBe(1);
    expect(frame0.activeWord).toBe('Build');
    expect(frame75.sceneNumber).toBe(1);
    expect(frame75.kenBurnsScale).toBe(1.04);
    expect(frame75.activeWord).toBe('affiliate');
    expect(frame75.captionWindow.length).toBe(5);
  });

  it('detects WebCodecs capability and falls back cleanly when absent', () => {
    const fallback = detectWebCodecsBrowserSupport({});
    expect(fallback.recommendedBackend).toBe('pure_js_h264_fallback');

    const webcodecs = detectWebCodecsBrowserSupport({
      VideoEncoder: () => {},
      AudioEncoder: () => {},
      OffscreenCanvas: () => {},
    });
    expect(webcodecs.recommendedBackend).toBe('webcodecs_audio_muxed');
  });
});

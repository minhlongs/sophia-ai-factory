import { describe, it, expect } from 'vitest';
import { mergeClipBoundaries } from '../clip-boundary-merger';
import type { HighlightClip } from '../highlight-scorer';
import type { SceneBoundary } from '../scene-detector';
import type { TranscriptWord } from '../clip-boundary-merger';

describe('clip-boundary-merger', () => {
  it('snaps highlights to nearest word boundaries when no sentence boundary is close', () => {
    const mockWordsFar: TranscriptWord[] = [
      { text: 'word1', start: 0, end: 500, confidence: 0.99 },
      { text: 'word2', start: 5000, end: 5400, confidence: 0.99 },
      { text: 'word3', start: 16000, end: 16700, confidence: 0.99 },
      { text: 'word4', start: 30000, end: 31000, confidence: 0.99 },
    ];

    const highlightsFar: HighlightClip[] = [
      {
        start_ms: 5200, // close to 5000 (word2 start). Sentence start (0) is 5200ms away (not close)
        end_ms: 16600,  // close to 16700 (word3 end). Sentence end (31000) is 14400ms away (not close)
        score: 0.8,
        title: 'Clip 1',
        reasoning: 'Test word snapping',
      },
    ];

    const result = mergeClipBoundaries(highlightsFar, [], mockWordsFar);
    expect(result).toHaveLength(1);
    expect(result[0].start_ms).toBe(5000);
    expect(result[0].end_ms).toBe(16700);
  });

  it('snaps highlights to sentence boundaries when within 3000ms', () => {
    const mockWords: TranscriptWord[] = [
      { text: 'Hello', start: 1000, end: 1500, confidence: 0.99 },
      { text: 'world.', start: 1600, end: 2000, confidence: 0.99 }, // sentence end at 2000, sentence start at 5000
      { text: 'This', start: 5000, end: 5500, confidence: 0.99 },
      { text: 'is', start: 5600, end: 6000, confidence: 0.99 },
      { text: 'awesome.', start: 6100, end: 16000, confidence: 0.99 }, // sentence end at 16000
      { text: 'Let', start: 20000, end: 21000, confidence: 0.99 }, // sentence start at 20000
    ];

    const highlights: HighlightClip[] = [
      {
        start_ms: 4500, // close to sentence start 'This' at 5000 (diff 500ms)
        end_ms: 15500,  // close to sentence end 'awesome.' at 16000 (diff 500ms)
        score: 0.8,
        title: 'Clip 2',
        reasoning: 'Test sentence snapping',
      },
    ];

    const result = mergeClipBoundaries(highlights, [], mockWords);
    expect(result).toHaveLength(1);
    expect(result[0].start_ms).toBe(5000);
    expect(result[0].end_ms).toBe(16000);
  });

  it('aligns to scene boundaries only if they do not cut inside words', () => {
    const mockWords: TranscriptWord[] = [
      { text: 'start', start: 2000, end: 3000, confidence: 0.99 },
      { text: 'middle', start: 7000, end: 8000, confidence: 0.99 },
      { text: 'word3', start: 10000, end: 11000, confidence: 0.99 }, // silence gap 11000 to 13000
      { text: 'word4', start: 13000, end: 14000, confidence: 0.99 },
      { text: 'last', start: 30000, end: 31000, confidence: 0.99 },
    ];

    const mockScenes: SceneBoundary[] = [
      { timestamp_ms: 12000 }, // scene at 12000ms. In the silence gap.
    ];

    const highlights: HighlightClip[] = [
      {
        start_ms: 2000,
        end_ms: 11200, // snaps to word3's end 11000. Scene is 12000 (diff 1000ms <= 2000ms)
        score: 0.8,
        title: 'Clip 3',
        reasoning: 'Scene alignment test',
      },
    ];

    const result = mergeClipBoundaries(highlights, mockScenes, mockWords);
    expect(result).toHaveLength(1);
    expect(result[0].start_ms).toBe(2000);
    expect(result[0].end_ms).toBe(12000); // end snapped to scene boundary 12000 since it is in silence
  });

  it('does not snap to scene boundary if it cuts a word', () => {
    const mockWords: TranscriptWord[] = [
      { text: 'start', start: 2000, end: 3000, confidence: 0.99 },
      { text: 'cutting', start: 11500, end: 12500, confidence: 0.99 }, // 12000ms scene boundary cuts inside this word!
      { text: 'end', start: 13000, end: 14000, confidence: 0.99 },
      { text: 'last', start: 30000, end: 31000, confidence: 0.99 },
    ];

    const mockScenes: SceneBoundary[] = [
      { timestamp_ms: 12000 },
    ];

    const highlights: HighlightClip[] = [
      {
        start_ms: 2000,
        end_ms: 12400, // close to 12000 scene
        score: 0.8,
        title: 'Clip 4',
        reasoning: 'Word cut test',
      },
    ];

    const result = mergeClipBoundaries(highlights, mockScenes, mockWords);
    expect(result).toHaveLength(1);
    expect(result[0].start_ms).toBe(2000);
    // Since 12000 cuts inside 'cutting' (11500 to 12500), it stays at 12500 (end of 'cutting' word)
    expect(result[0].end_ms).toBe(12500);
  });
});

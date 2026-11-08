/**
 * Unit tests for Word-Timestamp Aligner & R2 hash cache.
 * @module tree/video/subtitles/__tests__/word-timestamp-aligner.test
 */

import { describe, it, expect, vi } from 'vitest';
import {
  alignAudioWithR2Cache,
  alignedWordsToSrt,
  computeAlignmentCacheKey,
  formatSrtTimestamp,
  normalizeAlignmentText,
  normalizeWordTimestamps,
  type AlignmentR2BucketLike,
} from '../word-timestamp-aligner';

describe('word-timestamp-aligner', () => {
  it('normalizes text deterministically regardless of punctuation, case, or diacritics', async () => {
    const a = normalizeAlignmentText('  Hello,   WORLD!!  ');
    const b = normalizeAlignmentText('hello world');
    expect(a).toBe('hello world');
    expect(b).toBe('hello world');

    const key1 = await computeAlignmentCacheKey({
      voiceId: 'af_heart',
      speed: 1.0,
      text: 'Hello, World!',
    });
    const key2 = await computeAlignmentCacheKey({
      voiceId: 'af_heart',
      speed: 1.0,
      text: '  hello   world  ',
    });
    const keyDifferentSpeed = await computeAlignmentCacheKey({
      voiceId: 'af_heart',
      speed: 1.25,
      text: 'hello world',
    });

    expect(key1).toMatch(/^[a-f0-9]{64}$/);
    expect(key1).toBe(key2);
    expect(key1).not.toBe(keyDifferentSpeed);
  });

  it('enforces monotonic non-negative word timestamps and clamps to durationSec', () => {
    const raw = [
      { word: 'Welcome', start: -0.4, end: 0.3 },
      { word: 'back', start: 0.1, end: 0.2 }, // overlapping start & end < start after clamp
      { word: 'builders', start: 0.5, end: 9.5 }, // exceeds durationSec=2.0
    ];

    const aligned = normalizeWordTimestamps(raw, 2.0);
    expect(aligned).toHaveLength(3);
    expect(aligned[0]).toEqual({ word: 'Welcome', start: 0, end: 0.3 });
    expect(aligned[1].start).toBeGreaterThanOrEqual(aligned[0].end);
    expect(aligned[1].end).toBeGreaterThan(aligned[1].start);
    expect(aligned[2].end).toBeLessThanOrEqual(2.0);
    expect(aligned[2].start).toBeLessThan(aligned[2].end);
  });

  it('formats aligned words into valid numbered SRT cues without ms=1000 rollover', () => {
    expect(formatSrtTimestamp(1.9999)).toBe('00:00:02,000');
    const words = normalizeWordTimestamps([
      { word: 'Ship', start: 0, end: 0.4 },
      { word: 'fast', start: 0.4, end: 0.9 },
      { word: 'today', start: 0.9, end: 1.5 },
    ]);
    const srt = alignedWordsToSrt(words, 2);
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:00,900\nShip fast');
    expect(srt).toContain('2\n00:00:00,900 --> 00:00:01,500\ntoday');
  });

  it('writes aligned words to R2 on cache miss and serves from R2 on subsequent hit without re-transcribing', async () => {
    const store = new Map<string, string>();
    const fakeBucket: AlignmentR2BucketLike = {
      get: vi.fn(async (key: string) => {
        const val = store.get(key);
        if (!val) return null;
        return { json: async () => JSON.parse(val) };
      }),
      put: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      }),
    };

    const transcribeSpy = vi.fn(async () => [
      { word: 'Automate', start: 0.0, end: 0.45 },
      { word: 'everything', start: 0.45, end: 1.1 },
    ]);

    const first = await alignAudioWithR2Cache(
      {
        voiceId: 'af_heart',
        speed: 1.0,
        text: 'Automate everything!',
        audioR2Key: 'tenants/org_1/audio/vo.mp3',
        transcribe: transcribeSpy,
      },
      { getBucket: async () => fakeBucket },
    );

    expect(first.cacheHit).toBe(false);
    expect(first.entry.source).toBe('transcribed');
    expect(first.srt).toContain('Automate everything');
    expect(transcribeSpy).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(1);

    const second = await alignAudioWithR2Cache(
      {
        voiceId: 'af_heart',
        speed: 1.0,
        text: '  automate   everything ',
        audioR2Key: 'tenants/org_1/audio/vo.mp3',
        transcribe: transcribeSpy,
      },
      { getBucket: async () => fakeBucket },
    );

    expect(second.cacheHit).toBe(true);
    expect(second.entry.source).toBe('r2_cache');
    expect(second.srt).toBe(first.srt);
    expect(transcribeSpy).toHaveBeenCalledTimes(1);
  });
});

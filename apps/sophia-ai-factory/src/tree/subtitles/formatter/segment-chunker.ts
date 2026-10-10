/**
 * Segment Normalization and Chunking from Words
 *
 * @module tree/subtitles/formatter/segment-chunker
 */

import type { TranscriptWord, SubtitleSegment, SubtitleChunkOptions } from './types';
import { DEFAULT_OPTIONS } from './types';

/**
 * Validates and normalizes subtitle segments:
 * - Sorts segments chronologically by start time
 * - Clamps negative start/end times to 0
 * - Enforces minimum display duration if end <= start
 * - Enforces monotonic sequence IDs
 */
export function normalizeSegments(
  segments: SubtitleSegment[],
  minDurationSec = 0.5,
): SubtitleSegment[] {
  if (!segments || segments.length === 0) return [];

  // Clone and sort chronologically
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const normalized: SubtitleSegment[] = [];

  let lastEnd = 0;

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];
    let start = Math.max(0, isFinite(seg.start) ? seg.start : lastEnd);
    // Graceful monotonic correction: start cannot precede previous cue's start
    if (start < lastEnd && i > 0 && Math.abs(start - lastEnd) < 0.01) {
      start = lastEnd;
    }

    let end = isFinite(seg.end) ? seg.end : start + minDurationSec;
    if (end <= start) {
      end = start + minDurationSec;
    }

    const cleanText = (seg.text || '').trim();
    if (!cleanText) continue;

    lastEnd = end;
    normalized.push({
      id: normalized.length + 1,
      start,
      end,
      text: cleanText,
    });
  }

  return normalized;
}

/**
 * Group raw transcript words into readable subtitle segments.
 */
export function wordsToSegments(
  words: TranscriptWord[],
  options?: SubtitleChunkOptions,
): SubtitleSegment[] {
  if (!words || words.length === 0) return [];

  const opts = { ...DEFAULT_OPTIONS, ...options };
  // Filter and sort words
  const validWords = words
    .filter((w) => w && typeof w.word === 'string' && w.word.trim().length > 0)
    .map((w) => ({
      word: w.word.trim(),
      start: Math.max(0, isFinite(w.start) ? w.start : 0),
      end: Math.max(0, isFinite(w.end) ? w.end : 0),
    }))
    .sort((a, b) => a.start - b.start);

  if (validWords.length === 0) return [];

  const rawSegments: SubtitleSegment[] = [];
  let currentChunk: typeof validWords = [];

  const flushChunk = () => {
    if (currentChunk.length === 0) return;
    const start = currentChunk[0].start;
    let end = currentChunk[currentChunk.length - 1].end;
    if (end <= start) {
      end = start + opts.minCueDurationSec;
    }
    const text = currentChunk.map((w) => w.word).join(' ');
    rawSegments.push({
      id: rawSegments.length + 1,
      start,
      end,
      text,
    });
    currentChunk = [];
  };

  for (const word of validWords) {
    currentChunk.push(word);

    const chunkDuration = word.end - currentChunk[0].start;
    const chunkChars = currentChunk.reduce((sum, w) => sum + w.word.length + 1, 0);

    const shouldFlush =
      currentChunk.length >= opts.maxWordsPerChunk ||
      chunkChars >= opts.maxCharsPerChunk ||
      chunkDuration >= opts.maxCueDurationSec ||
      /[.!?]$/.test(word.word);

    if (shouldFlush) {
      flushChunk();
    }
  }

  flushChunk();
  return normalizeSegments(rawSegments, opts.minCueDurationSec);
}

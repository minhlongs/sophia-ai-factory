/**
 * Subtitle Formatter Engine
 *
 * Provides pure serialization and parsing for SubRip (.srt) and WebVTT (.vtt)
 * subtitle formats with millisecond-level precision, monotonic timestamp validation,
 * and robust handling of zero/negative durations.
 *
 * Layer: tree (pure domain logic, zero side-effects, no upper-layer imports)
 *
 * @module tree/subtitles/subtitle-formatter
 */

import type { TranscriptWord, SubtitleSegment, SubtitleFormat } from '@/seed/types/dubbing';

export interface SubtitleChunkOptions {
  /** Maximum words per subtitle block. Defaults to 8. */
  maxWordsPerChunk?: number;
  /** Maximum characters per subtitle block. Defaults to 42. */
  maxCharsPerChunk?: number;
  /** Minimum duration in seconds for any cue. Defaults to 0.5s. */
  minCueDurationSec?: number;
  /** Maximum duration in seconds for a single cue. Defaults to 7.0s. */
  maxCueDurationSec?: number;
}

const DEFAULT_OPTIONS: Required<SubtitleChunkOptions> = {
  maxWordsPerChunk: 8,
  maxCharsPerChunk: 42,
  minCueDurationSec: 0.5,
  maxCueDurationSec: 7.0,
};

/**
 * Format seconds into SRT timestamp format: HH:MM:SS,mmm
 */
export function formatSrtTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(safeSeconds * 1000);
  const ms = totalMs % 1000;
  const totalS = Math.floor(totalMs / 1000);
  const s = totalS % 60;
  const totalM = Math.floor(totalS / 60);
  const m = totalM % 60;
  const h = Math.floor(totalM / 60);

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Format seconds into WebVTT timestamp format: HH:MM:SS.mmm
 */
export function formatVttTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, isFinite(seconds) ? seconds : 0);
  const totalMs = Math.round(safeSeconds * 1000);
  const ms = totalMs % 1000;
  const totalS = Math.floor(totalMs / 1000);
  const s = totalS % 60;
  const totalM = Math.floor(totalS / 60);
  const m = totalM % 60;
  const h = Math.floor(totalM / 60);

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

/**
 * Parse an SRT or VTT timestamp string into seconds.
 * Accepts formats:
 * - HH:MM:SS,mmm or HH:MM:SS.mmm
 * - MM:SS,mmm or MM:SS.mmm
 */
export function parseTimestamp(timestamp: string): number {
  const clean = timestamp.trim().replace(',', '.');
  const parts = clean.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }

  const sec = parseFloat(clean);
  return isFinite(sec) ? Math.max(0, sec) : 0;
}

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

/**
 * Convert subtitle segments to SubRip (.srt) string.
 */
export function segmentsToSrt(segments: SubtitleSegment[]): string {
  const normalized = normalizeSegments(segments);
  if (normalized.length === 0) return '';

  return normalized
    .map((seg) => {
      const start = formatSrtTimestamp(seg.start);
      const end = formatSrtTimestamp(seg.end);
      return `${seg.id}\n${start} --> ${end}\n${seg.text}`;
    })
    .join('\n\n');
}

/**
 * Convert subtitle segments to WebVTT (.vtt) string.
 */
export function segmentsToVtt(segments: SubtitleSegment[]): string {
  const normalized = normalizeSegments(segments);
  if (normalized.length === 0) return 'WEBVTT\n';

  const body = normalized
    .map((seg) => {
      const start = formatVttTimestamp(seg.start);
      const end = formatVttTimestamp(seg.end);
      return `${seg.id}\n${start} --> ${end}\n${seg.text}`;
    })
    .join('\n\n');

  return `WEBVTT\n\n${body}\n`;
}

/**
 * Convert timestamped words directly to SRT subtitle file content.
 */
export function wordsToSrt(
  words: TranscriptWord[],
  options?: SubtitleChunkOptions,
): string {
  const segments = wordsToSegments(words, options);
  return segmentsToSrt(segments);
}

/**
 * Convert timestamped words directly to WebVTT subtitle file content.
 */
export function wordsToVtt(
  words: TranscriptWord[],
  options?: SubtitleChunkOptions,
): string {
  const segments = wordsToSegments(words, options);
  return segmentsToVtt(segments);
}

/**
 * Parse an SRT string into an array of SubtitleSegment objects.
 */
export function parseSrt(srtContent: string): SubtitleSegment[] {
  if (!srtContent || !srtContent.trim()) return [];

  // Normalize Windows CRLF and trailing spaces
  const clean = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  const blocks = clean.split(/\n\s*\n/);
  const segments: SubtitleSegment[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // Line 0 is usually the index, line 1 is timestamps
    // Some dirty SRTs omit the index line
    let timeLineIdx = 0;
    if (lines[0].includes('-->')) {
      timeLineIdx = 0;
    } else if (lines.length > 1 && lines[1].includes('-->')) {
      timeLineIdx = 1;
    } else {
      continue;
    }

    const timeParts = lines[timeLineIdx].split('-->');
    if (timeParts.length !== 2) continue;

    const start = parseTimestamp(timeParts[0]);
    const end = parseTimestamp(timeParts[1]);
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines.join(' ').trim();

    if (text) {
      segments.push({
        id: segments.length + 1,
        start,
        end,
        text,
      });
    }
  }

  return normalizeSegments(segments);
}

/**
 * Parse a WebVTT string into an array of SubtitleSegment objects.
 */
export function parseVtt(vttContent: string): SubtitleSegment[] {
  if (!vttContent || !vttContent.trim()) return [];

  const clean = vttContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^WEBVTT[^\n]*\n+/i, '')
    .trim();

  const blocks = clean.split(/\n\s*\n/);
  const segments: SubtitleSegment[] = [];

  for (const block of blocks) {
    // Skip comments or STYLE blocks
    if (block.startsWith('NOTE') || block.startsWith('STYLE') || block.startsWith('REGION')) {
      continue;
    }

    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    let timeLineIdx = 0;
    if (lines[0].includes('-->')) {
      timeLineIdx = 0;
    } else if (lines.length > 1 && lines[1].includes('-->')) {
      timeLineIdx = 1;
    } else {
      continue;
    }

    const timeParts = lines[timeLineIdx].split('-->');
    if (timeParts.length !== 2) continue;

    // WebVTT may have cue settings after end time, e.g. "00:01.000 --> 00:04.000 line:0 position:20%"
    const startStr = timeParts[0].trim();
    const endStr = timeParts[1].trim().split(/\s+/)[0];

    const start = parseTimestamp(startStr);
    const end = parseTimestamp(endStr);
    const textLines = lines.slice(timeLineIdx + 1);
    // Strip WebVTT tags like <v Voice>, <b>, <i>, <c.color>
    const text = textLines
      .join(' ')
      .replace(/<[^>]+>/g, '')
      .trim();

    if (text) {
      segments.push({
        id: segments.length + 1,
        start,
        end,
        text,
      });
    }
  }

  return normalizeSegments(segments);
}

/**
 * Convert between subtitle formats.
 */
export function convertSubtitleFormat(
  content: string,
  fromFormat: SubtitleFormat,
  toFormat: SubtitleFormat,
): string {
  if (fromFormat === toFormat) return content;

  const segments = fromFormat === 'srt' ? parseSrt(content) : parseVtt(content);
  return toFormat === 'srt' ? segmentsToSrt(segments) : segmentsToVtt(segments);
}

/**
 * SubRip (.srt) Serialization and Parsing
 *
 * @module tree/subtitles/formatter/srt-handler
 */

import type { SubtitleSegment, TranscriptWord, SubtitleChunkOptions } from './types';
import { formatSrtTimestamp, parseTimestamp } from './timestamp-utils';
import { normalizeSegments, wordsToSegments } from './segment-chunker';

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

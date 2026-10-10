/**
 * WebVTT (.vtt) Serialization, Parsing, and Cross-Format Conversion
 *
 * @module tree/subtitles/formatter/vtt-handler
 */

import type { SubtitleSegment, TranscriptWord, SubtitleChunkOptions, SubtitleFormat } from './types';
import { formatVttTimestamp, parseTimestamp } from './timestamp-utils';
import { normalizeSegments, wordsToSegments } from './segment-chunker';
import { parseSrt, segmentsToSrt } from './srt-handler';

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

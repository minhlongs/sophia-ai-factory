/**
 * Types and defaults for Subtitle Formatter Engine
 *
 * @module tree/subtitles/formatter/types
 */

import type { TranscriptWord, SubtitleSegment, SubtitleFormat } from '@/seed/types/dubbing';

export type { TranscriptWord, SubtitleSegment, SubtitleFormat };

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

export const DEFAULT_OPTIONS: Required<SubtitleChunkOptions> = {
  maxWordsPerChunk: 8,
  maxCharsPerChunk: 42,
  minCueDurationSec: 0.5,
  maxCueDurationSec: 7.0,
};

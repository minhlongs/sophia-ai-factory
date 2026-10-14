/**
 * Types and constants for clip boundary merging
 *
 * @module land/video/assembly/merger/types
 */

export interface ClipTranscriptWord {
  text: string;
  start: number; // ms
  end: number; // ms
  confidence: number;
}

export interface MergedClip {
  start_ms: number;
  end_ms: number;
  score: number;
  title: string;
  reasoning: string;
  hook_score?: number;
  pacing_score?: number;
  retention_score?: number;
  cta_score?: number;
  caption?: string;
  hashtags?: string[];
  subtitle_style?: string;
  tone?: string;
}

export const SNAP_TOLERANCE_MS = 2_000;
export const MIN_CLIP_MS = 10_000;
export const SENTENCE_TOLERANCE_MS = 3_000;

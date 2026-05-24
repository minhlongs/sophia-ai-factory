/**
 * Clip Boundary Merger — snaps LLM highlight timestamps to nearest scene cuts.
 * Deduplicates overlapping clips.
 */

import type { HighlightClip } from './highlight-scorer';
import type { SceneBoundary } from './scene-detector';

export interface MergedClip {
  start_ms: number;
  end_ms: number;
  score: number;
  title: string;
  reasoning: string;
}

const SNAP_TOLERANCE_MS = 2_000;
const MIN_CLIP_MS = 10_000;

function snapToNearest(ms: number, boundaries: SceneBoundary[]): number {
  if (boundaries.length === 0) return ms;

  let nearest = boundaries[0].timestamp_ms;
  let minDiff = Math.abs(ms - nearest);

  for (const b of boundaries) {
    const diff = Math.abs(ms - b.timestamp_ms);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = b.timestamp_ms;
    }
  }

  return minDiff <= SNAP_TOLERANCE_MS ? nearest : ms;
}

function overlaps(a: MergedClip, b: MergedClip): boolean {
  return a.start_ms < b.end_ms && b.start_ms < a.end_ms;
}

/**
 * Merges LLM highlights with scene boundaries.
 * Snaps start/end to nearest scene cut within 2s tolerance.
 * Removes clips that overlap with higher-scored clips.
 */
export function mergeClipBoundaries(
  highlights: HighlightClip[],
  scenes: SceneBoundary[],
): MergedClip[] {
  // Snap boundaries
  const snapped: MergedClip[] = highlights.map((h) => ({
    start_ms: snapToNearest(h.start_ms, scenes),
    end_ms: snapToNearest(h.end_ms, scenes),
    score: h.score,
    title: h.title,
    reasoning: h.reasoning,
  }));

  // Filter out clips that are too short after snapping
  const valid = snapped.filter((c) => c.end_ms - c.start_ms >= MIN_CLIP_MS);

  // Sort by score descending, then deduplicate overlapping clips
  valid.sort((a, b) => b.score - a.score);

  const deduped: MergedClip[] = [];
  for (const clip of valid) {
    const hasOverlap = deduped.some((existing) => overlaps(existing, clip));
    if (!hasOverlap) {
      deduped.push(clip);
    }
  }

  // Return in chronological order
  return deduped.sort((a, b) => a.start_ms - b.start_ms);
}

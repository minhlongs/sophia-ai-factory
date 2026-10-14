/**
 * Clip overlap detection and deduplication logic
 *
 * @module land/video/assembly/merger/clip-deduplicator
 */

import { MIN_CLIP_MS, type MergedClip } from './types';

export function overlaps(a: MergedClip, b: MergedClip): boolean {
  return a.start_ms < b.end_ms && b.start_ms < a.end_ms;
}

export function deduplicateClips(clips: MergedClip[]): MergedClip[] {
  // Filter out clips that are too short after snapping
  const valid = clips.filter((c) => c.end_ms - c.start_ms >= MIN_CLIP_MS);

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

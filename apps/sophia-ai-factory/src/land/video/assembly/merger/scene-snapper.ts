/**
 * Scene boundary snapping logic
 *
 * @module land/video/assembly/merger/scene-snapper
 */

import type { SceneBoundary } from '../../templates/scene-detector';
import { SNAP_TOLERANCE_MS, type ClipTranscriptWord } from './types';

export function snapToNearestScene(
  ms: number,
  boundaries: SceneBoundary[],
  words: ClipTranscriptWord[],
): number {
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

  if (minDiff <= SNAP_TOLERANCE_MS) {
    const cutsWord = words.some((w) => nearest > w.start && nearest < w.end);
    if (!cutsWord) {
      return nearest;
    }
  }

  return ms;
}

/**
 * Orchestrator for merging LLM highlights, scene boundaries, and words
 *
 * @module land/video/assembly/merger/boundary-merger
 */

import type { HighlightClip } from '../../generation/highlight-scorer';
import type { SceneBoundary } from '../../templates/scene-detector';
import type { ClipTranscriptWord, MergedClip } from './types';
import { snapToWordOrSentenceBoundary } from './word-snapper';
import { snapToNearestScene } from './scene-snapper';
import { deduplicateClips } from './clip-deduplicator';

/**
 * Merges LLM highlights with scene boundaries.
 * Snaps start/end to nearest sentence/word boundaries first.
 * Then aligns to scene boundaries if it doesn't cut speech.
 * Removes clips that overlap with higher-scored clips.
 */
export function mergeClipBoundaries(
  highlights: HighlightClip[],
  scenes: SceneBoundary[],
  words?: ClipTranscriptWord[],
): MergedClip[] {
  const snapped: MergedClip[] = highlights.map((h) => {
    let start = h.start_ms;
    let end = h.end_ms;
    if (words && words.length > 0) {
      start = snapToWordOrSentenceBoundary(start, words, true);
      end = snapToWordOrSentenceBoundary(end, words, false);
    }

    start = snapToNearestScene(start, scenes, words ?? []);
    end = snapToNearestScene(end, scenes, words ?? []);

    return {
      start_ms: start,
      end_ms: end,
      score: h.score,
      title: h.title,
      reasoning: h.reasoning,
      hook_score: h.hook_score,
      pacing_score: h.pacing_score,
      retention_score: h.retention_score,
      cta_score: h.cta_score,
      caption: h.caption,
      hashtags: h.hashtags,
      subtitle_style: h.subtitle_style,
      tone: h.tone,
    };
  });

  return deduplicateClips(snapped);
}

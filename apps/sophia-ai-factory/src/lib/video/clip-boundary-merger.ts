import type { HighlightClip } from './highlight-scorer';
import type { SceneBoundary } from './scene-detector';

export interface TranscriptWord {
  text: string;
  start: number; // ms
  end: number;   // ms
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

const SNAP_TOLERANCE_MS = 2_000;
const MIN_CLIP_MS = 10_000;

function snapToWordOrSentenceBoundary(
  ms: number,
  words: TranscriptWord[],
  isStart: boolean,
): number {
  if (words.length === 0) return ms;

  // Identify sentence boundaries based on punctuation
  const sentenceStarts: number[] = [words[0].start];
  const sentenceEnds: number[] = [];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const text = word.text.trim();
    const isPunctuation = /[.!?]$/.test(text);

    if (isPunctuation) {
      sentenceEnds.push(word.end);
      if (i + 1 < words.length) {
        sentenceStarts.push(words[i + 1].start);
      }
    }
  }

  if (words.length > 0 && !sentenceEnds.includes(words[words.length - 1].end)) {
    sentenceEnds.push(words[words.length - 1].end);
  }

  const SENTENCE_TOLERANCE_MS = 3_000;

  if (isStart) {
    // Find closest sentence start within tolerance
    let bestStart = -1;
    let minStartDiff = Infinity;
    for (const sStart of sentenceStarts) {
      const diff = Math.abs(ms - sStart);
      if (diff <= SENTENCE_TOLERANCE_MS && diff < minStartDiff) {
        minStartDiff = diff;
        bestStart = sStart;
      }
    }
    if (bestStart !== -1) return bestStart;

    // Fallback to closest word start
    let closestStart = words[0].start;
    let minDiff = Math.abs(ms - closestStart);
    for (const w of words) {
      const diff = Math.abs(ms - w.start);
      if (diff < minDiff) {
        minDiff = diff;
        closestStart = w.start;
      }
    }
    return closestStart;
  } else {
    // Find closest sentence end within tolerance
    let bestEnd = -1;
    let minEndDiff = Infinity;
    for (const sEnd of sentenceEnds) {
      const diff = Math.abs(ms - sEnd);
      if (diff <= SENTENCE_TOLERANCE_MS && diff < minEndDiff) {
        minEndDiff = diff;
        bestEnd = sEnd;
      }
    }
    if (bestEnd !== -1) return bestEnd;

    // Fallback to closest word end
    let closestEnd = words[0].end;
    let minDiff = Math.abs(ms - closestEnd);
    for (const w of words) {
      const diff = Math.abs(ms - w.end);
      if (diff < minDiff) {
        minDiff = diff;
        closestEnd = w.end;
      }
    }
    return closestEnd;
  }
}

function snapToNearestScene(
  ms: number,
  boundaries: SceneBoundary[],
  words: TranscriptWord[],
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
    // Verify it doesn't cut inside any word (must fall in silence/gap)
    const cutsWord = words.some((w) => nearest > w.start && nearest < w.end);
    if (!cutsWord) {
      return nearest;
    }
  }

  return ms;
}

function overlaps(a: MergedClip, b: MergedClip): boolean {
  return a.start_ms < b.end_ms && b.start_ms < a.end_ms;
}

/**
 * Merges LLM highlights with scene boundaries.
 * Snaps start/end to nearest sentence/word boundaries first.
 * Then aligns to scene boundaries if it doesn't cut speech.
 * Removes clips that overlap with higher-scored clips.
 */
export function mergeClipBoundaries(
  highlights: HighlightClip[],
  scenes: SceneBoundary[],
  words?: TranscriptWord[],
): MergedClip[] {
  const snapped: MergedClip[] = highlights.map((h) => {
    // 1. Snap to words/sentences first if available
    let start = h.start_ms;
    let end = h.end_ms;
    if (words && words.length > 0) {
      start = snapToWordOrSentenceBoundary(start, words, true);
      end = snapToWordOrSentenceBoundary(end, words, false);
    }

    // 2. Align to nearest scene boundary if within tolerance and doesn't cut words
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

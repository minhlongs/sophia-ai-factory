/**
 * Word and sentence boundary snapping for video transcripts
 *
 * @module land/video/assembly/merger/word-snapper
 */

import { SENTENCE_TOLERANCE_MS, type ClipTranscriptWord } from './types';

export function snapToWordOrSentenceBoundary(
  ms: number,
  words: ClipTranscriptWord[],
  isStart: boolean,
): number {
  if (words.length === 0) return ms;

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

  if (isStart) {
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
  }

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

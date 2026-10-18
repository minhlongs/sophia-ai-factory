/**
 * Caption Styler & Emoji/Keyword Enhancer.
 * Implements Alex Hormozi style rapid word popping, high-contrast keyword highlighting and automatic emoji badges.
 */

import type {
  CaptionChunk,
  SubtitleTheme,
  SubtitleTrackSpec,
  TimedCaptionWord,
} from './subtitle-types';
import {
  HIGH_CONVERTING_KEYWORDS,
  formatSubtitlesToVTT,
} from './caption-vtt-formatter';

export { formatSubtitlesToVTT };

export interface CaptionGenerationInput {
  scriptText: string;
  totalDurationSeconds: number;
  theme?: SubtitleTheme;
  wordsPerChunk?: number;
}

export function generateStyledSubtitles(
  input: CaptionGenerationInput
): SubtitleTrackSpec {
  const {
    scriptText,
    totalDurationSeconds,
    theme = 'hormozi_bold_yellow',
    wordsPerChunk = 3, // 2-4 words per screen for fast retention
  } = input;

  const rawWords = scriptText.trim().split(/\s+/).filter(Boolean);
  const totalWords = rawWords.length;
  if (totalWords === 0) {
    return {
      theme,
      totalDurationSeconds,
      chunks: [],
      totalWords: 0,
      highlightedWordsCount: 0,
    };
  }

  const durationPerWord = totalDurationSeconds / totalWords;
  const chunks: CaptionChunk[] = [];
  let highlightedWordsCount = 0;

  for (let i = 0; i < totalWords; i += wordsPerChunk) {
    const chunkWordsRaw = rawWords.slice(i, i + wordsPerChunk);
    const chunkStartIndex = i;
    const chunkStartTime = Number((chunkStartIndex * durationPerWord).toFixed(2));
    const chunkEndTime = Number(
      Math.min(
        totalDurationSeconds,
        (chunkStartIndex + chunkWordsRaw.length) * durationPerWord
      ).toFixed(2)
    );

    const timedWords: TimedCaptionWord[] = chunkWordsRaw.map((w, wIndex) => {
      const clean = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      const wordStart = Number(
        (chunkStartTime + wIndex * durationPerWord).toFixed(2)
      );
      const wordEnd = Number(
        Math.min(totalDurationSeconds, wordStart + durationPerWord).toFixed(2)
      );

      const keywordConfig = HIGH_CONVERTING_KEYWORDS[clean];
      if (keywordConfig) {
        highlightedWordsCount++;
        return {
          word: w.toUpperCase(),
          startTimeSeconds: wordStart,
          endTimeSeconds: wordEnd,
          isHighConvertingKeyword: true,
          highlightColor: keywordConfig.color,
          emojiBadge: keywordConfig.emoji,
          animation: keywordConfig.animation,
        };
      }

      return {
        word: w.toUpperCase(),
        startTimeSeconds: wordStart,
        endTimeSeconds: wordEnd,
        isHighConvertingKeyword: false,
        animation: 'pop_scale',
      };
    });

    chunks.push({
      chunkIndex: Math.floor(i / wordsPerChunk),
      startTimeSeconds: chunkStartTime,
      endTimeSeconds: chunkEndTime,
      text: chunkWordsRaw.join(' '),
      words: timedWords,
      theme,
      position: 'bottom',
    });
  }

  return {
    theme,
    totalDurationSeconds,
    chunks,
    totalWords,
    highlightedWordsCount,
  };
}

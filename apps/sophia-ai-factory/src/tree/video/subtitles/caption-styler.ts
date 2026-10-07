/**
 * Caption Styler & Emoji/Keyword Enhancer.
 * Implements Alex Hormozi style rapid word popping, high-contrast keyword highlighting and automatic emoji badges.
 */

import type {
  CaptionChunk,
  SubtitleTheme,
  SubtitleTrackSpec,
  TimedCaptionWord,
  WordAnimation,
} from './subtitle-types';

const HIGH_CONVERTING_KEYWORDS: Record<
  string,
  { color: string; emoji: string; animation: WordAnimation }
> = {
  // Financial & Revenue
  money: { color: '#00FF66', emoji: '💰', animation: 'bounce' },
  cash: { color: '#00FF66', emoji: '💵', animation: 'bounce' },
  profit: { color: '#00FF66', emoji: '📈', animation: 'pop_scale' },
  revenue: { color: '#00FF66', emoji: '💎', animation: 'pop_scale' },
  payout: { color: '#FFD700', emoji: '🏦', animation: 'pop_scale' },
  rich: { color: '#FFD700', emoji: '🤑', animation: 'bounce' },
  dollar: { color: '#00FF66', emoji: '💲', animation: 'pop_scale' },

  // Urgency & Tech
  ai: { color: '#00E5FF', emoji: '🤖', animation: 'glow' },
  secret: { color: '#FF0055', emoji: '🤫', animation: 'glow' },
  hack: { color: '#FF0055', emoji: '⚡', animation: 'pop_scale' },
  free: { color: '#FFE600', emoji: '🎁', animation: 'bounce' },
  fast: { color: '#FFE600', emoji: '🚀', animation: 'pop_scale' },
  viral: { color: '#FF007F', emoji: '🔥', animation: 'pop_scale' },
  stop: { color: '#FF0033', emoji: '🛑', animation: 'pop_scale' },

  // Crypto specifics
  crypto: { color: '#F7931A', emoji: '₿', animation: 'pop_scale' },
  bitcoin: { color: '#F7931A', emoji: '🪙', animation: 'glow' },
  solana: { color: '#9945FF', emoji: '⚡', animation: 'pop_scale' },
  airdrop: { color: '#00FFCC', emoji: '🪂', animation: 'bounce' },
  breakout: { color: '#00FF66', emoji: '🚀', animation: 'pop_scale' },
};

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

export function formatSubtitlesToVTT(spec: SubtitleTrackSpec): string {
  const lines: string[] = ['WEBVTT', ''];

  for (const chunk of spec.chunks) {
    const formatTime = (sec: number) => {
      const minutes = Math.floor(sec / 60);
      const seconds = Math.floor(sec % 60);
      const ms = Math.floor((sec % 1) * 1000);
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    };

    lines.push(
      `${formatTime(chunk.startTimeSeconds)} --> ${formatTime(chunk.endTimeSeconds)}`
    );

    const formattedText = chunk.words
      .map((w) => (w.emojiBadge ? `${w.word} ${w.emojiBadge}` : w.word))
      .join(' ');

    lines.push(formattedText);
    lines.push('');
  }

  return lines.join('\n');
}

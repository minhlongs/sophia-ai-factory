/**
 * Subtitle & Caption animation types.
 * High-retention short-form video typography styling (Hormozi style, Cyberpunk neon).
 */

export type SubtitleTheme =
  | 'hormozi_bold_yellow'
  | 'cyber_neon_green'
  | 'obsidian_minimal_white'
  | 'crypto_gold_fire';

export type WordAnimation = 'pop_scale' | 'bounce' | 'glow' | 'none';

export interface TimedCaptionWord {
  word: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  isHighConvertingKeyword: boolean;
  highlightColor?: string; // Hex color code
  emojiBadge?: string;
  animation: WordAnimation;
}

export interface CaptionChunk {
  chunkIndex: number;
  startTimeSeconds: number;
  endTimeSeconds: number;
  text: string;
  words: TimedCaptionWord[];
  theme: SubtitleTheme;
  position: 'bottom' | 'center' | 'top';
}

export interface SubtitleTrackSpec {
  theme: SubtitleTheme;
  totalDurationSeconds: number;
  chunks: CaptionChunk[];
  totalWords: number;
  highlightedWordsCount: number;
}

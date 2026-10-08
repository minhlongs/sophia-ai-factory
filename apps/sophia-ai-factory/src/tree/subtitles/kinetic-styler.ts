/**
 * @file kinetic-styler.ts
 * @description Smart kinetic subtitle formatter and karaoke timeline compiler
 * @layer tree
 */

import type {
  WordTimestamp,
  KineticSubtitleConfig,
  SubtitleAnimationPreset,
} from '@/seed/types/viral-expansion-types';

export interface StyledSubtitleFrame {
  screenIndex: number;
  startSec: number;
  endSec: number;
  words: Array<{
    word: string;
    isHighlighted: boolean;
    scaleMultiplier: number;
    colorHex: string;
  }>;
  emojiTag?: string;
  cssStylePreset: string;
}

const EMOJI_MAP: Record<string, string> = {
  money: '💸',
  cash: '💰',
  fire: '🔥',
  stop: '🛑',
  secret: '🤫',
  win: '🏆',
  fail: '❌',
  danger: '⚠️',
  fast: '⚡',
};

/**
 * Compiles raw word timestamps into kinetic animated subtitle frames.
 */
export function compileKineticSubtitles(
  timestamps: WordTimestamp[],
  config: KineticSubtitleConfig,
): StyledSubtitleFrame[] {
  const frames: StyledSubtitleFrame[] = [];
  const chunkSize = config.maxWordsPerScreen;

  for (let i = 0; i < timestamps.length; i += chunkSize) {
    const chunk = timestamps.slice(i, i + chunkSize);
    if (chunk.length === 0) continue;

    const startSec = chunk[0].startSec;
    const endSec = chunk[chunk.length - 1].endSec;

    let emojiTag: string | undefined;
    if (config.enableEmojiAutoInject) {
      for (const item of chunk) {
        const lower = item.word.toLowerCase().replace(/[^a-z]/g, '');
        if (EMOJI_MAP[lower]) {
          emojiTag = EMOJI_MAP[lower];
          break;
        }
      }
    }

    const styledWords = chunk.map((w, idx) => ({
      word: w.word,
      isHighlighted: idx === chunk.length - 1 || w.emphasis,
      scaleMultiplier: idx === chunk.length - 1 || w.emphasis ? 1.15 : 1.0,
      colorHex: idx === chunk.length - 1 || w.emphasis ? config.highlightColorHex : config.primaryColorHex,
    }));

    frames.push({
      screenIndex: Math.floor(i / chunkSize),
      startSec,
      endSec,
      words: styledWords,
      emojiTag,
      cssStylePreset: getCssPresetClass(config.preset),
    });
  }

  return frames;
}

function getCssPresetClass(preset: SubtitleAnimationPreset): string {
  switch (preset) {
    case 'HORMOZI_HIGHLIGHT':
      return 'font-black tracking-wide uppercase drop-shadow-[0_4px_4px_rgba(0,0,0,0.9)]';
    case 'BEAST_POP':
      return 'font-extrabold tracking-tight scale-110 drop-shadow-[0_8px_8px_rgba(0,0,0,0.8)]';
    case 'MINIMAL_CYBER':
      return 'font-mono text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]';
    case 'NEON_PULSE':
      return 'font-bold text-fuchsia-400 drop-shadow-[0_0_12px_rgba(232,121,249,0.8)]';
    default:
      return 'font-bold text-white';
  }
}

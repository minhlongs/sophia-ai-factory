/**
 * @file kinetic-styler.test.ts
 * @description Unit tests for Kinetic Subtitle Formatter and Emoji Injection
 */

import { describe, it, expect } from 'vitest';
import { compileKineticSubtitles } from '@/tree/subtitles/kinetic-styler';
import type { WordTimestamp, KineticSubtitleConfig } from '@/seed/types/viral-expansion-types';

describe('KineticStyler', () => {
  const mockConfig: KineticSubtitleConfig = {
    preset: 'HORMOZI_HIGHLIGHT',
    primaryColorHex: '#fbbf24',
    highlightColorHex: '#ef4444',
    fontSizePx: 36,
    maxWordsPerScreen: 3,
    enableEmojiAutoInject: true,
    textShadowGlow: true,
  };

  it('chunks timestamps according to maxWordsPerScreen', () => {
    const words: WordTimestamp[] = [
      { word: 'Stop', startSec: 0.1, endSec: 0.4, confidence: 1, emphasis: false },
      { word: 'wasting', startSec: 0.5, endSec: 0.8, confidence: 1, emphasis: false },
      { word: 'cash', startSec: 0.9, endSec: 1.2, confidence: 1, emphasis: false },
      { word: 'now', startSec: 1.3, endSec: 1.6, confidence: 1, emphasis: false },
    ];

    const frames = compileKineticSubtitles(words, mockConfig);
    expect(frames).toHaveLength(2);
    expect(frames[0].words).toHaveLength(3);
    expect(frames[1].words).toHaveLength(1);
  });

  it('injects relevant emoji based on semantic keywords', () => {
    const wordsWithMoney: WordTimestamp[] = [
      { word: 'Make', startSec: 0.1, endSec: 0.4, confidence: 1, emphasis: false },
      { word: 'more', startSec: 0.5, endSec: 0.8, confidence: 1, emphasis: false },
      { word: 'money', startSec: 0.9, endSec: 1.2, confidence: 1, emphasis: false },
    ];

    const frames = compileKineticSubtitles(wordsWithMoney, mockConfig);
    expect(frames[0].emojiTag).toBe('💸');
  });

  it('highlights designated emphasis words or the last word of each chunk', () => {
    const words: WordTimestamp[] = [
      { word: 'High', startSec: 0.1, endSec: 0.4, confidence: 1, emphasis: true },
      { word: 'Growth', startSec: 0.5, endSec: 0.8, confidence: 1, emphasis: false },
    ];

    const frames = compileKineticSubtitles(words, mockConfig);
    expect(frames[0].words[0].isHighlighted).toBe(true);
    expect(frames[0].words[0].colorHex).toBe('#ef4444');
    expect(frames[0].words[1].isHighlighted).toBe(true); // last word in chunk
  });
});

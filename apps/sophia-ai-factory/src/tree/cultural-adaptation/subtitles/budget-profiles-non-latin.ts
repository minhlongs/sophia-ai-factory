/**
 * Non-Latin (CJK, Southeast Asian & Middle Eastern) Subtitle Cultural Budget Profiles
 *
 * @module tree/cultural-adaptation/subtitles/budget-profiles-non-latin
 */

import type { SubtitleCulturalBudget } from '@/seed/types/cultural-adaptation';

export const NON_LATIN_LOCALE_BUDGETS: Record<string, SubtitleCulturalBudget> = {
  // CJK family
  ja: {
    locale: 'ja',
    minCps: 3,
    targetCps: 5,
    maxCps: 6,
    maxCpl: 16,
    maxLines: 2,
    wordWrapMode: 'bunsetsu',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [
      ['#FFFFFF', '#000000'], // White on black mourning contrast in specific contexts
    ],
    tabooSymbols: ['4', '9'], // Shi (death) and Ku (agony) associations in sensitive contexts
  },
  zh: {
    locale: 'zh',
    minCps: 3,
    targetCps: 5,
    maxCps: 6,
    maxCpl: 16,
    maxLines: 2,
    wordWrapMode: 'character',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [
      ['#FFFFFF', '#000000'],
    ],
    tabooSymbols: ['4', 'green_hat'],
  },
  ko: {
    locale: 'ko',
    minCps: 3,
    targetCps: 5,
    maxCps: 6,
    maxCpl: 18,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [
      ['#FF0000', '#FFFFFF'], // Writing names in red ink is culturally taboo
    ],
    tabooSymbols: ['4'],
  },

  // Southeast Asian & Middle Eastern families
  th: {
    locale: 'th',
    minCps: 8,
    targetCps: 12,
    maxCps: 14,
    maxCpl: 30,
    maxLines: 2,
    wordWrapMode: 'character',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [],
  },
  ar: {
    locale: 'ar',
    minCps: 9,
    targetCps: 14,
    maxCps: 15,
    maxCpl: 34,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [],
  },
  hi: {
    locale: 'hi',
    minCps: 9,
    targetCps: 14,
    maxCps: 16,
    maxCpl: 34,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [],
  },
};

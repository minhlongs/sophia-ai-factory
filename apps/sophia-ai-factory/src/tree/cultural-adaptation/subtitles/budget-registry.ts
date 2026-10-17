/**
 * Locale Cultural Budget Registry & Profiles
 *
 * @module tree/cultural-adaptation/subtitles/budget-registry
 */

import type { SubtitleCulturalBudget } from '@/seed/types/cultural-adaptation';
import { NON_LATIN_LOCALE_BUDGETS } from './budget-profiles-non-latin';

export { NON_LATIN_LOCALE_BUDGETS };

export const LOCALE_BUDGET_REGISTRY: Record<string, SubtitleCulturalBudget> = {
  // Latin family
  en: {
    locale: 'en',
    minCps: 10,
    targetCps: 16,
    maxCps: 17,
    maxCpl: 38,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [],
  },
  vi: {
    locale: 'vi',
    minCps: 10,
    targetCps: 16,
    maxCps: 17,
    maxCpl: 40,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'comma_decimal',
    tabooColorPairs: [],
  },
  es: {
    locale: 'es',
    minCps: 10,
    targetCps: 16,
    maxCps: 17,
    maxCpl: 40,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'comma_decimal',
    tabooColorPairs: [],
  },
  fr: {
    locale: 'fr',
    minCps: 10,
    targetCps: 15,
    maxCps: 17,
    maxCpl: 40,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'comma_decimal',
    tabooColorPairs: [],
  },
  de: {
    locale: 'de',
    minCps: 10,
    targetCps: 15,
    maxCps: 17,
    maxCpl: 38,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'comma_decimal',
    tabooColorPairs: [],
  },
  id: {
    locale: 'id',
    minCps: 10,
    targetCps: 16,
    maxCps: 17,
    maxCpl: 40,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'comma_decimal',
    tabooColorPairs: [],
  },
  ...NON_LATIN_LOCALE_BUDGETS,
};

export function getSubtitleCulturalBudget(locale: string): SubtitleCulturalBudget {
  const normalized = locale.toLowerCase().slice(0, 2);
  const budget = LOCALE_BUDGET_REGISTRY[normalized];
  if (budget) return budget;

  // Fallback to international Latin standard
  return {
    locale,
    minCps: 10,
    targetCps: 16,
    maxCps: 17,
    maxCpl: 38,
    maxLines: 2,
    wordWrapMode: 'space',
    numberFormatting: 'dot_decimal',
    tabooColorPairs: [],
  };
}

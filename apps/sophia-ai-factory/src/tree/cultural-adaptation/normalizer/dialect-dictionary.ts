/**
 * Dialect Dictionary & Token Replacement Helpers
 *
 * Layer: tree/cultural-adaptation/normalizer
 */

import type {
  RegionalDialect,
  DialectNormalizationRule,
} from '@/seed/types/cultural-adaptation';
import {
  EN_US_TO_UK_RULES,
  EN_UK_TO_US_RULES,
  JA_TOKYO_TO_OSAKA_RULES,
  JA_OSAKA_TO_TOKYO_RULES,
  VI_BAC_TO_NAM_RULES,
  VI_NAM_TO_BAC_RULES,
  VI_CENTRAL_TO_STANDARD_RULES,
  VI_STANDARD_TO_CENTRAL_RULES,
} from './phonetic-mapper';

export function preserveCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement.toLowerCase();
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace a word or phrase while respecting boundaries and casing.
 */
export function replaceToken(
  text: string,
  source: string,
  target: string,
): { newText: string; count: number } {
  const isCjk = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/.test(source);
  const regex = isCjk
    ? new RegExp(escapeRegex(source), 'g')
    : new RegExp(`(?<=^|\\P{L})${escapeRegex(source)}(?=\\P{L}|$)`, 'giu');

  let count = 0;
  const newText = text.replace(regex, (match) => {
    count++;
    return preserveCase(match, target);
  });

  return { newText, count };
}

const DIRECT_DIALECT_RULES_MAP: Record<string, readonly DialectNormalizationRule[]> = {
  'en-US->en-GB': EN_US_TO_UK_RULES,
  'en-GB->en-US': EN_UK_TO_US_RULES,
  'ja-JP-tokyo->ja-JP-osaka': JA_TOKYO_TO_OSAKA_RULES,
  'ja-JP-osaka->ja-JP-tokyo': JA_OSAKA_TO_TOKYO_RULES,
  'vi-VN-bac->vi-VN-nam': VI_BAC_TO_NAM_RULES,
  'vi-VN-nam->vi-VN-bac': VI_NAM_TO_BAC_RULES,
  'vi-VN-trung->vi-VN-bac': VI_CENTRAL_TO_STANDARD_RULES,
  'vi-VN-bac->vi-VN-trung': VI_STANDARD_TO_CENTRAL_RULES,
};

export function resolveDirectDialectRules(
  sourceDialect: RegionalDialect,
  targetDialect: RegionalDialect,
): readonly DialectNormalizationRule[] {
  return DIRECT_DIALECT_RULES_MAP[`${sourceDialect}->${targetDialect}`] ?? [];
}

export function applyEnglishMorphologicalRules(
  text: string,
  sourceDialect: RegionalDialect,
  targetDialect: RegionalDialect,
): { text: string; count: number; applied: DialectNormalizationRule[] } {
  let currentText = text;
  let totalCount = 0;
  const applied: DialectNormalizationRule[] = [];

  if (sourceDialect === 'en-US' && targetDialect === 'en-GB') {
    currentText = currentText.replace(/\b([a-zA-Z]+)or\b/gi, (match, prefix) => {
      const lower = match.toLowerCase();
      const ourWords = ['color', 'flavor', 'honor', 'humor', 'neighbor', 'labor', 'favor', 'harbor', 'rumor'];
      if (ourWords.includes(lower)) {
        totalCount++;
        applied.push({ sourceWord: match, targetWord: prefix + (match.endsWith('OR') ? 'OUR' : 'our') });
        return preserveCase(match, `${prefix}our`);
      }
      return match;
    });

    currentText = currentText.replace(/\b([a-zA-Z]+)ize(s|d|r|rs|d)?\b/gi, (match, stem, suffix) => {
      totalCount++;
      const suf = suffix || '';
      applied.push({ sourceWord: match, targetWord: `${stem}ise${suf}` });
      return preserveCase(match, `${stem}ise${suf}`);
    });
  } else if (sourceDialect === 'en-GB' && targetDialect === 'en-US') {
    currentText = currentText.replace(/\b([a-zA-Z]+)our\b/gi, (match, prefix) => {
      const lower = match.toLowerCase();
      const ourWords = ['colour', 'flavour', 'honour', 'humour', 'neighbour', 'labour', 'favour', 'harbour', 'rumour'];
      if (ourWords.includes(lower)) {
        totalCount++;
        applied.push({ sourceWord: match, targetWord: prefix + (match.endsWith('OUR') ? 'OR' : 'or') });
        return preserveCase(match, `${prefix}or`);
      }
      return match;
    });

    currentText = currentText.replace(/\b([a-zA-Z]+)ise(s|d|r|rs|d)?\b/gi, (match, stem, suffix) => {
      totalCount++;
      const suf = suffix || '';
      applied.push({ sourceWord: match, targetWord: `${stem}ize${suf}` });
      return preserveCase(match, `${stem}ize${suf}`);
    });
  }

  return { text: currentText, count: totalCount, applied };
}

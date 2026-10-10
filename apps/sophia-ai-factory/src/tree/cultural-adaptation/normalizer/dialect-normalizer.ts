/**
 * Script Text Dialect Normalizer Engine
 *
 * Layer: tree/cultural-adaptation/normalizer
 */

import type {
  RegionalDialect,
  DialectNormalizationRule,
} from '@/seed/types/cultural-adaptation';
import type { DialectNormalizationResult } from './types';
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

// ─── Helpers: Case Preservation & Word Boundary Matching ──────────────────────

function preserveCase(original: string, replacement: string): string {
  if (!original || !replacement) return replacement;
  if (original === original.toUpperCase() && original !== original.toLowerCase()) {
    return replacement.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement.toLowerCase();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace a word or phrase while respecting boundaries and casing.
 */
function replaceToken(text: string, source: string, target: string): { newText: string; count: number } {
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

// ─── Core Normalization Function ──────────────────────────────────────────────

/**
 * Perform bidirectional dialect normalization between regional variants.
 */
export function normalizeDialect(
  text: string,
  sourceDialect: RegionalDialect,
  targetDialect: RegionalDialect,
): DialectNormalizationResult {
  if (!text || sourceDialect === targetDialect) {
    return {
      sourceDialect,
      targetDialect,
      originalText: text,
      normalizedText: text,
      replacementsCount: 0,
      appliedRules: [],
    };
  }

  let rules: readonly DialectNormalizationRule[] = [];

  if (sourceDialect === 'en-US' && targetDialect === 'en-GB') {
    rules = EN_US_TO_UK_RULES;
  } else if (sourceDialect === 'en-GB' && targetDialect === 'en-US') {
    rules = EN_UK_TO_US_RULES;
  } else if (sourceDialect === 'ja-JP-tokyo' && targetDialect === 'ja-JP-osaka') {
    rules = JA_TOKYO_TO_OSAKA_RULES;
  } else if (sourceDialect === 'ja-JP-osaka' && targetDialect === 'ja-JP-tokyo') {
    rules = JA_OSAKA_TO_TOKYO_RULES;
  } else if (sourceDialect === 'vi-VN-bac' && targetDialect === 'vi-VN-nam') {
    rules = VI_BAC_TO_NAM_RULES;
  } else if (sourceDialect === 'vi-VN-nam' && targetDialect === 'vi-VN-bac') {
    rules = VI_NAM_TO_BAC_RULES;
  } else if (sourceDialect === 'vi-VN-trung' && targetDialect === 'vi-VN-bac') {
    rules = VI_CENTRAL_TO_STANDARD_RULES;
  } else if (sourceDialect === 'vi-VN-trung' && targetDialect === 'vi-VN-nam') {
    const std = normalizeDialect(text, 'vi-VN-trung', 'vi-VN-bac');
    const south = normalizeDialect(std.normalizedText, 'vi-VN-bac', 'vi-VN-nam');
    return {
      sourceDialect,
      targetDialect,
      originalText: text,
      normalizedText: south.normalizedText,
      replacementsCount: std.replacementsCount + south.replacementsCount,
      appliedRules: [...std.appliedRules, ...south.appliedRules],
    };
  } else if (sourceDialect === 'vi-VN-bac' && targetDialect === 'vi-VN-trung') {
    rules = VI_STANDARD_TO_CENTRAL_RULES;
  } else if (sourceDialect === 'vi-VN-nam' && targetDialect === 'vi-VN-trung') {
    const std = normalizeDialect(text, 'vi-VN-nam', 'vi-VN-bac');
    const central = normalizeDialect(std.normalizedText, 'vi-VN-bac', 'vi-VN-trung');
    return {
      sourceDialect,
      targetDialect,
      originalText: text,
      normalizedText: central.normalizedText,
      replacementsCount: std.replacementsCount + central.replacementsCount,
      appliedRules: [...std.appliedRules, ...central.appliedRules],
    };
  }

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

  for (const rule of rules) {
    const { newText, count } = replaceToken(currentText, rule.sourceWord, rule.targetWord);
    if (count > 0) {
      currentText = newText;
      totalCount += count;
      applied.push(rule);
    }
  }

  return {
    sourceDialect,
    targetDialect,
    originalText: text,
    normalizedText: currentText,
    replacementsCount: totalCount,
    appliedRules: applied,
  };
}

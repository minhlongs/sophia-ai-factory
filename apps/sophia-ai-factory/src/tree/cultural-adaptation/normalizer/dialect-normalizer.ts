/**
 * Script Text Dialect Normalizer Engine
 *
 * Layer: tree/cultural-adaptation/normalizer
 */

import type { RegionalDialect } from '@/seed/types/cultural-adaptation';
import type { DialectNormalizationResult } from './types';
import {
  applyEnglishMorphologicalRules,
  escapeRegex,
  preserveCase,
  replaceToken,
  resolveDirectDialectRules,
} from './dialect-dictionary';

export {
  applyEnglishMorphologicalRules,
  escapeRegex,
  preserveCase,
  replaceToken,
  resolveDirectDialectRules,
};

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

  if (sourceDialect === 'vi-VN-trung' && targetDialect === 'vi-VN-nam') {
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
  }

  if (sourceDialect === 'vi-VN-nam' && targetDialect === 'vi-VN-trung') {
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

  const rules = resolveDirectDialectRules(sourceDialect, targetDialect);
  const morphResult = applyEnglishMorphologicalRules(text, sourceDialect, targetDialect);

  let currentText = morphResult.text;
  let totalCount = morphResult.count;
  const applied = [...morphResult.applied];

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

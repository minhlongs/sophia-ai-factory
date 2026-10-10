/**
 * Types and Contracts for Regional Dialect Normalization
 *
 * Layer: tree/cultural-adaptation/normalizer
 */

import type {
  RegionalDialect,
  DialectNormalizationRule,
  DialectProsody,
} from '@/seed/types/cultural-adaptation';

export interface DialectNormalizationResult {
  sourceDialect: RegionalDialect;
  targetDialect: RegionalDialect;
  originalText: string;
  normalizedText: string;
  replacementsCount: number;
  appliedRules: DialectNormalizationRule[];
}

export type {
  RegionalDialect,
  DialectNormalizationRule,
  DialectProsody,
};

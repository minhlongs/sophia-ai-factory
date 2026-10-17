/**
 * Regional Dialect Normalization & Subtitle Cultural Budgeting Contracts
 *
 * Layer: seed (pure types, constants, schemas, zero side effects)
 *
 * @module seed/types/cultural-adaptation-dialect-subtitle
 */

import { z } from 'zod';

// ─── Regional Dialects ────────────────────────────────────────────────────────

export const REGIONAL_DIALECTS = [
  'en-US',
  'en-GB',
  'ja-JP-tokyo',
  'ja-JP-osaka',
  'vi-VN-bac',
  'vi-VN-trung',
  'vi-VN-nam',
] as const;

export const RegionalDialectSchema = z.enum(REGIONAL_DIALECTS);
export type RegionalDialect = z.infer<typeof RegionalDialectSchema>;

// ─── Dialect Normalization Rules ──────────────────────────────────────────────

export interface DialectNormalizationRule {
  sourceWord: string;
  targetWord: string;
  contextHint?: string;
  isRegex?: boolean;
}

export interface DialectProsody {
  pitchOffset: string; // e.g. "+0Hz", "+5Hz", "-3Hz"
  rateMultiplier: number; // e.g. 1.05, 0.98
  cadenceStyle: 'standard' | 'staccato' | 'melodic' | 'authoritative';
}

export interface DialectProfile {
  dialect: RegionalDialect;
  displayName: string;
  baseLocale: string;
  dialectCode: string;
  gender: 'male' | 'female' | 'neutral';
  edgeVoiceName: string;
  prosody: DialectProsody;
  lexicon: DialectNormalizationRule[];
  minTier: 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';
}

// ─── Subtitle Cultural Budgeting ──────────────────────────────────────────────

export type WordWrapMode = 'space' | 'bunsetsu' | 'character';
export type NumberFormattingStyle = 'comma_decimal' | 'dot_decimal';

export interface SubtitleCulturalBudget {
  locale: string;
  minCps: number;
  targetCps: number;
  maxCps: number; // Characters per second (Latin: 15-17, CJK: 4-6, Thai: 10-14)
  maxCpl: number; // Characters per line
  maxLines: number;
  wordWrapMode: WordWrapMode;
  numberFormatting: NumberFormattingStyle;
  tabooColorPairs: Array<[string, string]>;
  tabooSymbols?: string[];
}

export const SubtitleCulturalBudgetSchema = z.object({
  locale: z.string(),
  minCps: z.number().positive(),
  targetCps: z.number().positive(),
  maxCps: z.number().positive(),
  maxCpl: z.number().int().positive(),
  maxLines: z.number().int().positive(),
  wordWrapMode: z.enum(['space', 'bunsetsu', 'character']),
  numberFormatting: z.enum(['comma_decimal', 'dot_decimal']),
  tabooColorPairs: z.array(z.tuple([z.string(), z.string()])),
  tabooSymbols: z.array(z.string()).optional(),
});

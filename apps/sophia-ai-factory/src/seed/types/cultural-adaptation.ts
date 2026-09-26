/**
 * Cultural Adaptation, Regional Compliance & Subtitle Budgeting Contracts
 *
 * Layer: seed (pure types, constants, schemas, zero side effects)
 * Supports Milestone $800k MRR: Regional dialect normalization, AI ad compliance,
 * and script-aware subtitle typography.
 *
 * @module seed/types/cultural-adaptation
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

// ─── Compliance Jurisdictions & Categories ────────────────────────────────────

export const COMPLIANCE_JURISDICTIONS = ['EU', 'US', 'JP', 'VN', 'SG', 'GLOBAL'] as const;
export const ComplianceJurisdictionSchema = z.enum(COMPLIANCE_JURISDICTIONS);
export type ComplianceJurisdiction = z.infer<typeof ComplianceJurisdictionSchema>;

export const ComplianceCategorySchema = z.enum([
  'ai_disclosure',
  'stealth_marketing',
  'data_privacy',
  'consumer_protection',
]);
export type ComplianceCategory = z.infer<typeof ComplianceCategorySchema>;

export const ComplianceStatusSchema = z.enum(['passed', 'flagged', 'remediated', 'rejected']);
export type ComplianceStatus = z.infer<typeof ComplianceStatusSchema>;

export const DisclosurePositionSchema = z.enum([
  'bottom_right',
  'bottom_left',
  'top_right',
  'top_left',
  'intro_frame',
  'outro_frame',
]);
export type DisclosurePosition = z.infer<typeof DisclosurePositionSchema>;

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

// ─── Compliance Result Contracts ──────────────────────────────────────────────

export interface ComplianceViolation {
  category: ComplianceCategory | string;
  ruleId: string;
  matchedText: string;
  message: string;
  severity: 'warning' | 'error';
}

export interface ComplianceRequiredLabels {
  visualLabelText: string;
  localLabelText: string;
  audioDisclaimerText?: string;
  position: DisclosurePosition;
  watermarkRequired: boolean;
  audioDisclosureRequired: boolean;
}

export interface ComplianceValidationResult {
  jurisdiction: ComplianceJurisdiction;
  compliant: boolean;
  violations: ComplianceViolation[];
  requiredLabels: ComplianceRequiredLabels;
  remediatedScript?: string;
}

export const ComplianceValidationResultSchema = z.object({
  jurisdiction: ComplianceJurisdictionSchema,
  compliant: z.boolean(),
  violations: z.array(
    z.object({
      category: z.string(),
      ruleId: z.string(),
      matchedText: z.string(),
      message: z.string(),
      severity: z.enum(['warning', 'error']),
    }),
  ),
  requiredLabels: z.object({
    visualLabelText: z.string(),
    localLabelText: z.string(),
    audioDisclaimerText: z.string().optional(),
    position: DisclosurePositionSchema,
    watermarkRequired: z.boolean(),
    audioDisclosureRequired: z.boolean(),
  }),
  remediatedScript: z.string().optional(),
});

export interface ContentAuditRecord {
  id: string;
  tenantId: string;
  videoId: string;
  regionCode: ComplianceJurisdiction;
  complianceStatus: ComplianceStatus;
  violationsDetected: string[];
  remediationsApplied: string[];
  aiLabelInjected: boolean;
  auditedBy: string;
  createdAt: number;
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

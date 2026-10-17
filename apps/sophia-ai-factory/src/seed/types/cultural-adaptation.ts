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

export {
  REGIONAL_DIALECTS,
  RegionalDialectSchema,
  type RegionalDialect,
  type DialectNormalizationRule,
  type DialectProsody,
  type DialectProfile,
  type WordWrapMode,
  type NumberFormattingStyle,
  type SubtitleCulturalBudget,
  SubtitleCulturalBudgetSchema,
} from './cultural-adaptation-dialect-subtitle';

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

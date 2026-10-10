/**
 * Compliance Types and Models
 *
 * Layer: tree/cultural-adaptation/compliance
 */
import type {
  ComplianceJurisdiction,
  ComplianceValidationResult,
  ComplianceViolation,
  ComplianceRequiredLabels,
  ContentAuditRecord,
  DisclosurePosition,
  ComplianceStatus,
} from '@/seed/types/cultural-adaptation';
export type {
  ComplianceJurisdiction,
  ComplianceValidationResult,
  ComplianceViolation,
  ComplianceRequiredLabels,
  ContentAuditRecord,
  DisclosurePosition,
  ComplianceStatus,
};
export interface JurisdictionRuleDef {
  jurisdiction: ComplianceJurisdiction;
  mandatoryLabelEn: string;
  mandatoryLabelLocal: string;
  audioDisclaimerEn: string;
  audioDisclaimerLocal: string;
  defaultPosition: DisclosurePosition;
  watermarkRequired: boolean;
  audioDisclosureRequired: boolean;
  forbiddenRules: Array<{
    ruleId: string;
    category: string;
    regex: RegExp;
    message: string;
    severity: 'warning' | 'error';
    safeReplacement?: string;
  }>;
}
export interface ScanContentOptions {
  hasAiVoice?: boolean;
  hasAiAvatar?: boolean;
  customRules?: Array<{
    ruleId: string;
    regex: RegExp;
    message: string;
    severity?: 'warning' | 'error';
  }>;
}
export interface GeneratedAiDisclosure {
  visualLabel: {
    textEn: string;
    textLocal: string;
    position: DisclosurePosition;
    opacity: number;
    backgroundColor: string;
    textColor: string;
  };
  audioDisclaimer?: {
    textEn: string;
    textLocal: string;
    estimatedDurationSec: number;
  };
}
export interface RemediationResult {
  remediatedScript: string;
  replacements: Array<{
    original: string;
    replacement: string;
    ruleId: string;
    reason: string;
  }>;
}

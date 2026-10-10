/**
 * Compliance Engine (Scanner, Remediator & Audit Record)
 *
 * Layer: tree/cultural-adaptation/compliance
 */
import type {
  ComplianceJurisdiction,
  ComplianceValidationResult,
  ComplianceViolation,
  ComplianceRequiredLabels,
  ContentAuditRecord,
  ComplianceStatus,
} from '@/seed/types/cultural-adaptation';
import type { ScanContentOptions, RemediationResult } from './types';
import { JURISDICTION_RULES } from './jurisdiction-rules';
export function scanContentCompliance(
  script: string,
  jurisdiction: ComplianceJurisdiction,
  options?: ScanContentOptions,
): ComplianceValidationResult {
  const ruleDef = JURISDICTION_RULES[jurisdiction] || JURISDICTION_RULES.GLOBAL;
  const violations: ComplianceViolation[] = [];
  for (const rule of ruleDef.forbiddenRules) {
    const matches = script.match(rule.regex);
    if (matches && matches.length > 0) {
      for (const m of Array.from(new Set(matches))) {
        violations.push({
          category: rule.category,
          ruleId: rule.ruleId,
          matchedText: m,
          message: rule.message,
          severity: rule.severity,
        });
      }
    }
  }
  if (options?.customRules) {
    for (const rule of options.customRules) {
      const matches = script.match(rule.regex);
      if (matches && matches.length > 0) {
        for (const m of Array.from(new Set(matches))) {
          violations.push({
            category: 'custom_compliance',
            ruleId: rule.ruleId,
            matchedText: m,
            message: rule.message,
            severity: rule.severity || 'warning',
          });
        }
      }
    }
  }
  const hasSyntheticAudio = options?.hasAiVoice ?? true;
  const audioDisclaimer =
    ruleDef.audioDisclosureRequired && hasSyntheticAudio ? ruleDef.audioDisclaimerLocal : undefined;
  const requiredLabels: ComplianceRequiredLabels = {
    visualLabelText: ruleDef.mandatoryLabelEn,
    localLabelText: ruleDef.mandatoryLabelLocal,
    audioDisclaimerText: audioDisclaimer,
    position: ruleDef.defaultPosition,
    watermarkRequired: ruleDef.watermarkRequired,
    audioDisclosureRequired: ruleDef.audioDisclosureRequired,
  };
  const hasBlockingErrors = violations.some((v) => v.severity === 'error');
  return {
    jurisdiction,
    compliant: !hasBlockingErrors,
    violations,
    requiredLabels,
  };
}
export function remediateContentCompliance(
  script: string,
  jurisdiction: ComplianceJurisdiction,
): RemediationResult {
  const ruleDef = JURISDICTION_RULES[jurisdiction] || JURISDICTION_RULES.GLOBAL;
  let remediated = script;
  const replacements: RemediationResult['replacements'] = [];
  for (const rule of ruleDef.forbiddenRules) {
    if (rule.safeReplacement) {
      remediated = remediated.replace(rule.regex, (match) => {
        replacements.push({
          original: match,
          replacement: rule.safeReplacement!,
          ruleId: rule.ruleId,
          reason: rule.message,
        });
        return rule.safeReplacement!;
      });
    }
  }
  return {
    remediatedScript: remediated,
    replacements,
  };
}
export function createContentAuditRecord(params: {
  tenantId: string;
  videoId: string;
  jurisdiction: ComplianceJurisdiction;
  script: string;
  validationResult?: ComplianceValidationResult;
  auditedBy?: string;
}): ContentAuditRecord {
  const scan = params.validationResult || scanContentCompliance(params.script, params.jurisdiction);
  let status: ComplianceStatus = 'passed';
  if (!scan.compliant) {
    status = 'rejected';
  } else if (scan.violations.length > 0) {
    status = 'flagged';
  }
  const violationsDetected = scan.violations.map((v) => `[${v.ruleId}] ${v.matchedText}: ${v.message}`);
  const randomPart = Math.random().toString(36).slice(2, 10);
  const auditId = `audit-${Date.now()}-${randomPart}`;
  return {
    id: auditId,
    tenantId: params.tenantId,
    videoId: params.videoId,
    regionCode: params.jurisdiction,
    complianceStatus: status,
    violationsDetected,
    remediationsApplied: [],
    aiLabelInjected: scan.requiredLabels.watermarkRequired,
    auditedBy: params.auditedBy || 'system_compliance_engine',
    createdAt: Date.now(),
  };
}

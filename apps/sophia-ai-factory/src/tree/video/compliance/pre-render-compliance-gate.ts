/**
 * @module tree/video/compliance/pre-render-compliance-gate
 * Pre-Render Compliance Gate: blocks prohibited jurisdictions and prohibited financial claims.
 */

import { evaluateJurisdictionCompliance } from './jurisdiction-compliance-guard';
import { PROHIBITED_LEXICAL_RULES, type LexicalRuleViolation } from '@/seed/config/compliance-lexical-rules';
import type { VideoNiche } from '@/seed/config/video-blueprints/blueprint-types';

export interface PreRenderComplianceCheckInput {
  niche: VideoNiche;
  targetJurisdiction?: string;
  scriptText: string;
  overlayText?: string;
}

export interface PreRenderComplianceDecision {
  isAllowed: boolean;
  jurisdiction: string;
  niche: VideoNiche;
  blockingReason?: string;
  regulatoryRef?: string;
  lexicalViolations: LexicalRuleViolation[];
  suggestedRewritesEn: string[];
  suggestedRewritesVi: string[];
}

export function evaluatePreRenderCompliance(
  input: PreRenderComplianceCheckInput,
): PreRenderComplianceDecision {
  const geoResult = evaluateJurisdictionCompliance(input.niche, input.targetJurisdiction);
  const combinedText = `${input.scriptText} ${input.overlayText ?? ''}`;
  const violations: LexicalRuleViolation[] = [];

  for (const rule of PROHIBITED_LEXICAL_RULES) {
    const match = rule.pattern.exec(combinedText);
    if (match) {
      violations.push({
        ruleId: rule.ruleId,
        matchedPhrase: match[0],
        regulatoryBasis: rule.regulatoryBasis,
        safeReplacementEn: rule.safeReplacementEn,
        safeReplacementVi: rule.safeReplacementVi,
      });
    }
  }

  const isGeoBlocked = !geoResult.isAllowed;
  const isLexicalBlocked = violations.length > 0;
  const isAllowed = !isGeoBlocked && !isLexicalBlocked;

  let blockingReason: string | undefined;
  let regulatoryRef = geoResult.regulatoryRef;

  if (isGeoBlocked) {
    blockingReason = geoResult.reason;
  } else if (isLexicalBlocked) {
    blockingReason = `PROHIBITED_FINANCIAL_CLAIM: ${violations[0]?.ruleId}`;
    regulatoryRef = violations[0]?.regulatoryBasis;
  }

  return {
    isAllowed,
    jurisdiction: geoResult.jurisdiction,
    niche: input.niche,
    blockingReason,
    regulatoryRef,
    lexicalViolations: violations,
    suggestedRewritesEn: violations.map((v) => v.safeReplacementEn),
    suggestedRewritesVi: violations.map((v) => v.safeReplacementVi),
  };
}

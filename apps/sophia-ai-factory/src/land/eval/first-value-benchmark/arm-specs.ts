/**
 * Arm comparison specifications and deterministic trial ID / direct-model prompt builders.
 *
 * @module land/eval/first-value-benchmark/arm-specs
 */

import type { BenchmarkArmId, EvaluationBrief } from './types';

export interface ArmComparisonSpec {
  readonly armId: BenchmarkArmId;
  readonly label: string;
  readonly orchestration: string;
  readonly formatting: string;
  readonly validation: string;
  readonly parityGuarantee: string;
}

export const ARM_COMPARISON_SPECS: Readonly<Record<BenchmarkArmId, ArmComparisonSpec>> = {
  arm_a_sophia_basic: {
    armId: 'arm_a_sophia_basic',
    label: 'Sophia BASIC First-Value Workflow',
    orchestration:
      'BasicFirstValueService: org membership guard -> BYOK receipt -> deterministic cost preview -> script generation -> review gate.',
    formatting:
      'Structured JSON scenes (scene_number, visual_description, narration, duration_estimate) rendered to neutral text for blinding.',
    validation: 'validateParsedScriptStructure(minScenes=3, targetDurationSec) with idempotency key deduplication.',
    parityGuarantee:
      'Uses identical plannedModelId, plannedModelVersion, temperature, and maxOutputTokensBudget as Arm B in live mode.',
  },
  arm_b_direct_model: {
    armId: 'arm_b_direct_model',
    label: 'Direct Model Minimal Baseline',
    orchestration: 'Single direct prompt constructed solely from the frozen brief with no Sophia workflow wrappers or retries.',
    formatting: 'Minimal plain-text / neutral scene-list output rendered to the same blind-review text representation.',
    validation: 'Minimal non-empty text check only; no Sophia structural schema enforcement.',
    parityGuarantee:
      'Receives identical brief fields, plannedModelId, plannedModelVersion, temperature, and maxOutputTokensBudget as Arm A.',
  },
};

export function buildTrialId(
  configVersion: string,
  briefId: string,
  armId: BenchmarkArmId,
  trialNumber: number,
): string {
  return `${configVersion}:${briefId}:${armId}:t${trialNumber}`;
}

export function buildDirectModelPrompt(brief: EvaluationBrief): string {
  return [
    `Write a short-form video script (${brief.expectedDeliverable}).`,
    `Product/Service: ${brief.productOrService}`,
    `Target Audience: ${brief.targetAudience}`,
    `Platform: ${brief.intendedPlatform}`,
    `Campaign Objective: ${brief.campaignObjective}`,
    `Brand Voice: ${brief.brandVoice}`,
    `Language: ${brief.language}`,
    `Required CTA: ${brief.requiredCta}`,
    `Content Restrictions: ${brief.contentRestrictions.join('; ')}`,
  ].join('\n');
}

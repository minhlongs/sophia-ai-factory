/**
 * Production Sophia BASIC prompt-construction, parsing, and structural validation
 * parity bridge for Arm A in the B4.1 Stage 1 calibration harness.
 *
 * Imports and invokes the actual production prompt builders and validator directly
 * (zero prompt duplication, zero simplified parser stubs).
 *
 * @module land/eval/first-value-benchmark/arm-a-production-parity
 */

import {
  SCRIPT_SYSTEM_PROMPT,
  buildScriptUserPrompt,
  type ScriptOutput,
} from '@/seed/ai/script-prompt-builders';
import {
  InvalidScriptStructureError,
  rethrowMappedProviderError,
  validateParsedScriptStructure,
} from '@/seed/ai/script-generator-helpers';
import { ProviderInvalidKeyError, ProviderQuotaExceededError } from '@/seed/services/errors';
import type { EvaluationBrief } from './types';

export const STAGE1_DEFAULT_TARGET_DURATION_SEC = 30;
export const STAGE1_ARM_A_MIN_SCENES = 3;
export const STAGE1_MIN_FEASIBLE_OUTPUT_TOKENS = 600;

export interface ExperimentalParameterComparison {
  readonly variantClassification: 'BUDGET_BOUNDED_SOPHIA_BASIC_VARIANT';
  readonly productionRetryDefault: number;
  readonly stage1MaxRetriesPerTrial: number;
  readonly productionMaxTokensDefault: number;
  readonly stage1MaxOutputTokensCap: number;
  readonly productionTemperature: number;
  readonly stage1Temperature: number;
  readonly stage1TimeoutMs: number;
  readonly providerFallbackEnabled: false;
  readonly armAResponseFormat: 'json_object';
  readonly armBResponseFormat: 'text';
  readonly rationale: string;
}

export const STAGE1_EXPERIMENTAL_CONFIG: ExperimentalParameterComparison = {
  variantClassification: 'BUDGET_BOUNDED_SOPHIA_BASIC_VARIANT',
  productionRetryDefault: 3,
  stage1MaxRetriesPerTrial: 1,
  productionMaxTokensDefault: 4096,
  stage1MaxOutputTokensCap: 1200,
  productionTemperature: 0.3,
  stage1Temperature: 0.3,
  stage1TimeoutMs: 120_000,
  providerFallbackEnabled: false,
  armAResponseFormat: 'json_object',
  armBResponseFormat: 'text',
  rationale:
    'Stage 1 bounds retries to 1 (vs production callOpenRouter maxRetries=3) and caps max_tokens to 1200 (vs 4096) to enforce the $3/30-call calibration ceiling; results measure a budget-bounded Sophia BASIC variant.',
};

export interface NormalizedProductionScriptInput {
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly language: EvaluationBrief['language'];
}

export interface ArmAProductionPrompt {
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly combinedPrompt: string;
  readonly normalizedInput: NormalizedProductionScriptInput;
}

export function normalizeBriefForProductionScript(
  brief: EvaluationBrief,
  targetDurationSec: number = STAGE1_DEFAULT_TARGET_DURATION_SEC,
): NormalizedProductionScriptInput {
  const languageLabel = brief.language === 'vi' ? 'Vietnamese' : 'English';
  const restrictionsClause =
    brief.contentRestrictions.length > 0
      ? `, restrictions: ${brief.contentRestrictions.map((r) => r.trim()).join('; ')}`
      : '';
  const topic = [
    `${brief.productOrService.trim()} — ${brief.campaignObjective.trim()}`,
    `(platform: ${brief.intendedPlatform}, language: ${languageLabel} [${brief.language}], voice: ${brief.brandVoice.trim()}, CTA: ${brief.requiredCta.trim()}${restrictionsClause})`,
  ].join(' ');
  const audience = `${brief.targetAudience.trim()} (${languageLabel})`;
  return {
    topic,
    audience,
    durationSec: targetDurationSec,
    language: brief.language,
  };
}

/**
 * Constructs Arm A's exact production prompts by calling SCRIPT_SYSTEM_PROMPT and
 * buildScriptUserPrompt directly, and formats the combined prompt identically to
 * src/seed/ai/script-generator.ts#generateScript.
 */
export function buildArmAProductionPrompt(
  brief: EvaluationBrief,
  targetDurationSec: number = STAGE1_DEFAULT_TARGET_DURATION_SEC,
): ArmAProductionPrompt {
  const normalizedInput = normalizeBriefForProductionScript(brief, targetDurationSec);
  const systemPrompt = SCRIPT_SYSTEM_PROMPT;
  const userPrompt = buildScriptUserPrompt(
    normalizedInput.topic,
    normalizedInput.audience,
    undefined,
    undefined,
    normalizedInput.durationSec,
  );
  const combinedPrompt = `System: ${systemPrompt}\n\nUser: ${userPrompt}`;
  return { systemPrompt, userPrompt, combinedPrompt, normalizedInput };
}

export function renderValidatedScriptToNeutralText(script: ScriptOutput): string {
  const lines = [`Title: ${script.title}`, `Target Duration: ${script.total_duration}s`];
  for (const scene of script.scenes) {
    lines.push(
      `Scene ${scene.scene_number} (${scene.duration_estimate}s) | Visual: ${scene.visual_description} | Narration: ${scene.narration}`,
    );
  }
  return lines.join('\n');
}

export type ArmAOutputValidationResult =
  | { readonly ok: true; readonly script: ScriptOutput; readonly renderedOutput: string }
  | {
      readonly ok: false;
      readonly errorCode: 'INVALID_JSON' | 'INVALID_SCRIPT_STRUCTURE';
      readonly message: string;
    };

/**
 * Applies the exact production parsing and structural validation contract used by
 * generateScript + BasicFirstValueService.generateScriptForReview (strict JSON.parse,
 * no markdown fence stripping, validateParsedScriptStructure with minScenes=3).
 */
export function parseAndValidateArmAOutput(
  rawContent: string,
  options?: { readonly minScenes?: number; readonly targetDurationSec?: number },
): ArmAOutputValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return {
      ok: false,
      errorCode: 'INVALID_JSON',
      message: 'Invalid JSON from LLM',
    };
  }

  try {
    const script = validateParsedScriptStructure(parsed, {
      minScenes: options?.minScenes ?? STAGE1_ARM_A_MIN_SCENES,
      targetDurationSec: options?.targetDurationSec,
    });
    return {
      ok: true,
      script,
      renderedOutput: renderValidatedScriptToNeutralText(script),
    };
  } catch (err) {
    return {
      ok: false,
      errorCode: 'INVALID_SCRIPT_STRUCTURE',
      message: err instanceof Error ? err.message : 'Invalid script structure',
    };
  }
}

export function classifyArmAProductionError(
  error: unknown,
): 'INVALID_SCRIPT_STRUCTURE' | 'PROVIDER_QUOTA_EXCEEDED' | 'PROVIDER_INVALID_KEY' | 'UNKNOWN_ERROR' {
  try {
    rethrowMappedProviderError(error);
  } catch (mapped) {
    if (mapped instanceof InvalidScriptStructureError) return 'INVALID_SCRIPT_STRUCTURE';
    if (mapped instanceof ProviderQuotaExceededError) return 'PROVIDER_QUOTA_EXCEEDED';
    if (mapped instanceof ProviderInvalidKeyError) return 'PROVIDER_INVALID_KEY';
    return 'UNKNOWN_ERROR';
  }
}

export function assessOutputTokenCapFeasibility(
  maxOutputTokensCap: number,
): { readonly feasible: boolean; readonly classification: 'FEASIBLE' | 'INFEASIBLE_BUDGET_CAP'; readonly reason: string } {
  if (!Number.isSafeInteger(maxOutputTokensCap) || maxOutputTokensCap < STAGE1_MIN_FEASIBLE_OUTPUT_TOKENS) {
    return {
      feasible: false,
      classification: 'INFEASIBLE_BUDGET_CAP',
      reason: `maxOutputTokensCap=${maxOutputTokensCap} is below minimum ${STAGE1_MIN_FEASIBLE_OUTPUT_TOKENS} tokens required for 3-5 scene Sophia BASIC JSON output`,
    };
  }
  return {
    feasible: true,
    classification: 'FEASIBLE',
    reason: `maxOutputTokensCap=${maxOutputTokensCap} satisfies minimum ${STAGE1_MIN_FEASIBLE_OUTPUT_TOKENS} token threshold for 3-5 scene JSON output`,
  };
}

export function buildMockProductionScriptJson(
  brief: EvaluationBrief,
  targetDurationSec: number = STAGE1_DEFAULT_TARGET_DURATION_SEC,
): string {
  const scene1 = Math.max(5, Math.round(targetDurationSec * 0.25));
  const scene2 = Math.max(5, Math.round(targetDurationSec * 0.45));
  const scene3 = Math.max(5, targetDurationSec - scene1 - scene2);
  const script: ScriptOutput = {
    title: `${brief.productOrService} (${brief.language})`,
    scenes: [
      {
        scene_number: 1,
        visual_description: `Opening ${brief.intendedPlatform} hook tailored for ${brief.targetAudience}`,
        narration: `Hook for ${brief.productOrService}: ${brief.campaignObjective}`,
        duration_estimate: scene1,
      },
      {
        scene_number: 2,
        visual_description: `Benefit showcase in ${brief.brandVoice} style`,
        narration: `Delivering ${brief.expectedDeliverable} for ${brief.targetAudience}`,
        duration_estimate: scene2,
      },
      {
        scene_number: 3,
        visual_description: `Closing CTA frame for ${brief.intendedPlatform}`,
        narration: brief.requiredCta,
        duration_estimate: scene3,
      },
    ],
    total_duration: scene1 + scene2 + scene3,
  };
  return JSON.stringify(script);
}

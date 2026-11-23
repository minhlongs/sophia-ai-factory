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
export const STAGE1_VIETNAMESE_MIN_FEASIBLE_OUTPUT_TOKENS = 750;
export const STAGE1_REASONING_TOKEN_RESERVE = 600;

export type EvalResponseFormatMode = 'omitted' | 'json_object' | 'text';
export type OpenAiReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh';

export const GPT54_MINI_SUPPORTED_REASONING_EFFORTS: readonly OpenAiReasoningEffort[] = [
  'none',
  'low',
  'medium',
  'high',
  'xhigh',
] as const;

export interface ExperimentalParameterComparison {
  readonly variantClassification: 'BUDGET_BOUNDED_SOPHIA_BASIC_VARIANT';
  readonly productionRetryDefault: number;
  readonly stage1MaxRetriesPerTrial: number;
  readonly productionMaxTokensDefault: number;
  readonly stage1MaxOutputTokensCap: number;
  readonly productionTemperature: number;
  readonly stage1Temperature: number;
  readonly stage1ReasoningEffort: OpenAiReasoningEffort;
  readonly stage1MaxTokensParam: 'max_completion_tokens';
  readonly productionMaxTokensParam: 'max_tokens';
  readonly stage1TimeoutMs: number;
  readonly providerFallbackEnabled: false;
  readonly productionResponseFormat: 'omitted';
  readonly armAResponseFormat: 'omitted';
  readonly armBResponseFormat: 'text';
  readonly semanticParitySummary: string;
  readonly transportDifferencesSummary: string;
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
  stage1ReasoningEffort: 'none',
  stage1MaxTokensParam: 'max_completion_tokens',
  productionMaxTokensParam: 'max_tokens',
  stage1TimeoutMs: 120_000,
  providerFallbackEnabled: false,
  productionResponseFormat: 'omitted',
  armAResponseFormat: 'omitted',
  armBResponseFormat: 'text',
  semanticParitySummary:
    'Arm A invokes exact production SCRIPT_SYSTEM_PROMPT, buildScriptUserPrompt, strict JSON.parse, validateParsedScriptStructure(minScenes=3), temperature=0.3, and omits response_format identically to production openrouter-caller.ts.',
  transportDifferencesSummary:
    'Stage 1 uses direct OpenAI Chat Completions with max_completion_tokens=1200 (vs OpenRouter max_tokens=4096), reasoning_effort="none" (required for temperature=0.3 on gpt-5.4-mini and zero hidden reasoning token overhead), maxRetriesPerTrial=1 (vs 3), and full usage/model/fingerprint receipt capture.',
  rationale:
    'Stage 1 omits response_format to match production openrouter-caller.ts, bounds retries to 1 (vs production maxRetries=3), and caps max_completion_tokens to 1200 (vs 4096) under reasoning_effort="none" to enforce the $3/30-call calibration ceiling; results measure a budget-bounded Sophia BASIC variant.',
};

export interface OpenAiDirectRequestInput {
  readonly modelId: string;
  readonly prompt: string;
  readonly maxOutputTokens: number;
  readonly temperature: number;
  readonly reasoningEffort?: string;
  readonly responseFormat: EvalResponseFormatMode;
  readonly armId: 'arm_a_sophia_basic' | 'arm_b_direct_model';
}

export interface OpenAiChatCompletionsPayload {
  readonly model: string;
  readonly messages: readonly [{ readonly role: 'user'; readonly content: string }];
  readonly max_completion_tokens: number;
  readonly temperature: number;
  readonly reasoning_effort: OpenAiReasoningEffort;
  readonly response_format?: { readonly type: 'json_object' };
}

export interface OpenAiMappedRequestResult {
  readonly payload: OpenAiChatCompletionsPayload;
  readonly responseFormatParity:
    | 'MATCHES_PRODUCTION_OMITTED'
    | 'EXPERIMENTAL_RESPONSE_FORMAT_OVERRIDE'
    | 'ARM_B_NEUTRAL_TEXT';
}

function isSupportedGpt54MiniEffort(value: string): value is OpenAiReasoningEffort {
  return (GPT54_MINI_SUPPORTED_REASONING_EFFORTS as readonly string[]).includes(value);
}

/**
 * Pure request-parameter mapper for OpenAI direct Chat Completions (`gpt-5.4-mini-2026-03-17`).
 * Enforces official GPT-5.4 parameter compatibility:
 * - emits `max_completion_tokens` (never deprecated `max_tokens`);
 * - validates `reasoning_effort` against gpt-5.4-mini supported values;
 * - rejects non-default `temperature` (!== 1) when `reasoning_effort !== 'none'`;
 * - omits `response_format` for Arm A by default to match production `openrouter-caller.ts`
 *   and explicitly flags any experimental override.
 */
export function buildOpenAiDirectRequestPayload(input: OpenAiDirectRequestInput): OpenAiMappedRequestResult {
  const effort = input.reasoningEffort ?? STAGE1_EXPERIMENTAL_CONFIG.stage1ReasoningEffort;
  if (!isSupportedGpt54MiniEffort(effort)) {
    throw new Error(
      `UNSUPPORTED_PROVIDER_PARAMETER: reasoning_effort="${effort}" is not supported by gpt-5.4-mini (allowed: ${GPT54_MINI_SUPPORTED_REASONING_EFFORTS.join(', ')})`,
    );
  }
  if (!Number.isFinite(input.temperature) || input.temperature < 0 || input.temperature > 2) {
    throw new Error(`UNSUPPORTED_PROVIDER_PARAMETER: temperature=${input.temperature} must be within 0..2`);
  }
  if (effort !== 'none' && input.temperature !== 1) {
    throw new Error(
      `UNSUPPORTED_PROVIDER_PARAMETER: temperature=${input.temperature} is unsupported on gpt-5.4-mini when reasoning_effort="${effort}" (requires reasoning_effort="none")`,
    );
  }
  if (!Number.isSafeInteger(input.maxOutputTokens) || input.maxOutputTokens <= 0 || input.maxOutputTokens > 128_000) {
    throw new Error(
      `UNSUPPORTED_PROVIDER_PARAMETER: max_completion_tokens=${input.maxOutputTokens} must be an integer in 1..128000`,
    );
  }

  const basePayload: OpenAiChatCompletionsPayload = {
    model: input.modelId,
    messages: [{ role: 'user', content: input.prompt }],
    max_completion_tokens: input.maxOutputTokens,
    temperature: input.temperature,
    reasoning_effort: effort,
    ...(input.responseFormat === 'json_object' ? { response_format: { type: 'json_object' } } : {}),
  };

  let responseFormatParity: OpenAiMappedRequestResult['responseFormatParity'];
  if (input.armId === 'arm_b_direct_model') {
    responseFormatParity = 'ARM_B_NEUTRAL_TEXT';
  } else if (input.responseFormat === 'omitted') {
    responseFormatParity = 'MATCHES_PRODUCTION_OMITTED';
  } else {
    responseFormatParity = 'EXPERIMENTAL_RESPONSE_FORMAT_OVERRIDE';
  }

  return { payload: basePayload, responseFormatParity };
}

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

export interface TokenCapFeasibilityOptions {
  readonly briefs?: readonly EvaluationBrief[];
  readonly minScenes?: number;
  readonly targetDurationSec?: number;
  readonly reasoningEffort?: OpenAiReasoningEffort;
  readonly extraSchemaOverheadTokens?: number;
}

export interface TokenCapFeasibilityAssessment {
  readonly feasible: boolean;
  readonly classification: 'FEASIBLE' | 'INFEASIBLE_BUDGET_CAP';
  readonly failureCategory: null | 'PREFLIGHT_INFEASIBLE';
  readonly estimatedMinRequiredTokens: number;
  readonly hasVietnameseBriefs: boolean;
  readonly redesignRequired: boolean;
  readonly redesignCode: 'STAGE1_TOKEN_CAP_REDESIGN_REQUIRED' | null;
  readonly reason: string;
}

/**
 * Conservatively estimates the minimum output tokens required for a valid Sophia BASIC
 * JSON script (title + total_duration + >= minScenes scenes with visual_description,
 * narration, duration_estimate, JSON syntax overhead, and Vietnamese subword density).
 * Never assumes 1 character = 1 token; never expands maxOutputTokensCap automatically.
 */
export function assessOutputTokenCapFeasibility(
  maxOutputTokensCap: number,
  options?: TokenCapFeasibilityOptions,
): TokenCapFeasibilityAssessment {
  const minScenes = Math.max(STAGE1_ARM_A_MIN_SCENES, options?.minScenes ?? STAGE1_ARM_A_MIN_SCENES);
  const targetDurationSec = Math.max(15, options?.targetDurationSec ?? STAGE1_DEFAULT_TARGET_DURATION_SEC);
  const hasVietnameseBriefs = (options?.briefs ?? []).some((b) => b.language === 'vi');
  const reasoningEffort = options?.reasoningEffort ?? STAGE1_EXPERIMENTAL_CONFIG.stage1ReasoningEffort;
  const extraSchemaOverhead = Math.max(0, options?.extraSchemaOverheadTokens ?? 0);

  // Conservative schema-aware estimate (JSON envelope + per-scene fields + duration scaling + VI UTF-8 subword density)
  const jsonEnvelopeTokens = 90;
  const durationScale = Math.max(1, targetDurationSec / STAGE1_DEFAULT_TARGET_DURATION_SEC);
  const basePerSceneTokens = hasVietnameseBriefs ? 220 : 170;
  const sceneTokens = Math.ceil(minScenes * basePerSceneTokens * durationScale);
  const reasoningReserve = reasoningEffort === 'none' ? 0 : STAGE1_REASONING_TOKEN_RESERVE;
  const baseFloor = hasVietnameseBriefs
    ? STAGE1_VIETNAMESE_MIN_FEASIBLE_OUTPUT_TOKENS
    : STAGE1_MIN_FEASIBLE_OUTPUT_TOKENS;
  const estimatedMinRequiredTokens = Math.max(
    baseFloor,
    jsonEnvelopeTokens + sceneTokens + extraSchemaOverhead,
  ) + reasoningReserve;

  if (!Number.isSafeInteger(maxOutputTokensCap) || maxOutputTokensCap < estimatedMinRequiredTokens) {
    return {
      feasible: false,
      classification: 'INFEASIBLE_BUDGET_CAP',
      failureCategory: 'PREFLIGHT_INFEASIBLE',
      estimatedMinRequiredTokens,
      hasVietnameseBriefs,
      redesignRequired: true,
      redesignCode: 'STAGE1_TOKEN_CAP_REDESIGN_REQUIRED',
      reason: `maxOutputTokensCap=${maxOutputTokensCap} is below conservative minimum ${estimatedMinRequiredTokens} tokens required for ${minScenes}-scene ${hasVietnameseBriefs ? 'EN+VI ' : ''}Sophia BASIC JSON output (reasoning_effort=${reasoningEffort})`,
    };
  }
  return {
    feasible: true,
    classification: 'FEASIBLE',
    failureCategory: null,
    estimatedMinRequiredTokens,
    hasVietnameseBriefs,
    redesignRequired: false,
    redesignCode: null,
    reason: `maxOutputTokensCap=${maxOutputTokensCap} satisfies conservative minimum ${estimatedMinRequiredTokens} token threshold for ${minScenes}-scene ${hasVietnameseBriefs ? 'EN+VI ' : ''}Sophia BASIC JSON output (reasoning_effort=${reasoningEffort})`,
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

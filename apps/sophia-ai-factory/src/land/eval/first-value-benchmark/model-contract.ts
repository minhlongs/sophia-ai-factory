/**
 * Verified 2026 Provider/Model Version & Pricing Contract + Sophia BASIC Call-Graph Spec.
 * Enforces integer micro-USD cost math and explicit MODEL_PARITY_UNVERIFIED flagging
 * when an immutable snapshot or response version match cannot be established.
 *
 * @module land/eval/first-value-benchmark/model-contract
 */

import { assertSafeNonNegativeInteger } from './report-validators';

export type ModelProviderId = 'openai' | 'anthropic';

export interface PinnedModelPricingContract {
  readonly pricingVersion: string;
  readonly verifiedDateIso: string;
  readonly sourceUrl: string;
  readonly provider: ModelProviderId;
  readonly modelId: string;
  readonly immutableSnapshotPinned: boolean;
  readonly snapshotLimitationNote: string;
  readonly inputMicroUsdPerMillionTokens: number;
  readonly outputMicroUsdPerMillionTokens: number;
  readonly cachedInputMicroUsdPerMillionTokens: number;
  readonly maxContextTokens: number;
  readonly maxInputTokens: number;
  readonly maxOutputTokens: number;
  readonly supportsUsageMetadata: boolean;
  readonly supportsProviderSpendCap: boolean;
  readonly dataRetentionSummary: string;
  readonly recommendedForStage1: boolean;
}

export interface SophiaBasicCallGraphContract {
  readonly armASourceEntrypoint: string;
  readonly armAPromptBuilder: string;
  readonly armAValidationStep: string;
  readonly armAProductionTransport: string;
  readonly armBPromptBuilder: string;
  readonly minBillableCallsPerTrial: number;
  readonly expectedBillableCallsPerTrial: number;
  readonly productionTransportWorstCaseCallsPerTrial: number;
  readonly productionTransportDefaultMaxTokens: number;
  readonly stage1BoundedMaxRetriesPerTrial: number;
  readonly stage1BoundedMaxCallsPerTrial: number;
  readonly stage1LogicalTrials: number;
  readonly stage1RunMaxBillableCallsCeiling: number;
  readonly discrepancySummary: string;
  readonly boundedSolutionSummary: string;
}

/**
 * Verified from source inspection of BasicFirstValueService, generateScript, and callOpenRouter.
 */
export const SOPHIA_BASIC_CALL_GRAPH_CONTRACT: SophiaBasicCallGraphContract = {
  armASourceEntrypoint: 'src/land/first-value/basic-first-value-service.ts#generateScriptForReview',
  armAPromptBuilder: 'src/seed/ai/script-prompt-builders.ts#SCRIPT_SYSTEM_PROMPT+buildScriptUserPrompt',
  armAValidationStep: 'src/seed/ai/script-generator-helpers.ts#validateParsedScriptStructure(minScenes=3)',
  armAProductionTransport: 'src/seed/inference/openrouter/openrouter-caller.ts#callOpenRouter',
  armBPromptBuilder: 'src/land/eval/first-value-benchmark/arm-specs.ts#buildDirectModelPrompt',
  minBillableCallsPerTrial: 1,
  expectedBillableCallsPerTrial: 1,
  productionTransportWorstCaseCallsPerTrial: 4,
  productionTransportDefaultMaxTokens: 4096,
  stage1BoundedMaxRetriesPerTrial: 1,
  stage1BoundedMaxCallsPerTrial: 2,
  stage1LogicalTrials: 20,
  stage1RunMaxBillableCallsCeiling: 30,
  discrepancySummary:
    'callOpenRouter defaults to maxRetries=3 (up to 4 attempts/trial = up to 80 calls across 20 logical trials), hardcodes max_tokens=4096, and drops usage/model/fingerprint metadata.',
  boundedSolutionSummary:
    'Stage 1 evaluation adapter enforces maxRetriesPerTrial=1 (max 2 attempts/trial), caps max_tokens=1200, captures full usage+model+fingerprint receipts, and gates every attempt+retry under a 30-call Cost Governor ceiling.',
};

/**
 * Verified 2026 official first-party provider pricing (no stale PDF prices, no unpinned OpenRouter failover).
 */
export const PINNED_MODEL_CONTRACTS: Readonly<Record<string, PinnedModelPricingContract>> = {
  'gpt-5.4-mini-2026-03-17': {
    pricingVersion: 'openai-2026-11-23-v1',
    verifiedDateIso: '2026-11-23',
    sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5.4-mini',
    provider: 'openai',
    modelId: 'gpt-5.4-mini-2026-03-17',
    immutableSnapshotPinned: true,
    snapshotLimitationNote:
      'Pinned dated snapshot (gpt-5.4-mini-2026-03-17); still verify echoed response model ID and system_fingerprint on every call.',
    inputMicroUsdPerMillionTokens: 750_000,
    outputMicroUsdPerMillionTokens: 4_500_000,
    cachedInputMicroUsdPerMillionTokens: 75_000,
    maxContextTokens: 400_000,
    maxInputTokens: 272_000,
    maxOutputTokens: 128_000,
    supportsUsageMetadata: true,
    supportsProviderSpendCap: true,
    dataRetentionSummary:
      'OpenAI API does not train on API inputs/outputs by default; 30-day abuse-monitoring retention unless Zero Data Retention (ZDR) is enabled.',
    recommendedForStage1: true,
  },
  'claude-haiku-5-5': {
    pricingVersion: 'anthropic-2026-11-23-v1',
    verifiedDateIso: '2026-11-23',
    sourceUrl: 'https://platform.claude.com/docs/en/about-claude/pricing',
    provider: 'anthropic',
    modelId: 'claude-haiku-5-5',
    immutableSnapshotPinned: false,
    snapshotLimitationNote:
      'claude-haiku-5-5 is a model alias without a verified dated snapshot pin; backend weights may update silently, so MODEL_PARITY_UNVERIFIED applies unless response model ID confirms an immutable snapshot.',
    inputMicroUsdPerMillionTokens: 100_000,
    outputMicroUsdPerMillionTokens: 500_000,
    cachedInputMicroUsdPerMillionTokens: 10_000,
    maxContextTokens: 1_000_000,
    maxInputTokens: 100_000,
    maxOutputTokens: 128_000,
    supportsUsageMetadata: true,
    supportsProviderSpendCap: true,
    dataRetentionSummary:
      'Anthropic commercial API does not train on API inputs/outputs by default; standard 30-day safety retention unless ZDR agreement applies.',
    recommendedForStage1: false,
  },
};

export interface ObservedModelVersionEvidence {
  readonly provider: string;
  readonly requestedModelId: string;
  readonly responseModelId: string | null;
  readonly modelFingerprint: string | null;
  readonly requestTimestampIso: string;
}

export interface ModelParityAssessment {
  readonly status: 'VERIFIED' | 'MODEL_PARITY_UNVERIFIED';
  readonly reasons: readonly string[];
}

export function verifyModelVersionParity(
  contract: PinnedModelPricingContract,
  observed: ObservedModelVersionEvidence,
): ModelParityAssessment {
  const reasons: string[] = [];
  if (observed.provider !== contract.provider) {
    reasons.push(`provider_mismatch:${observed.provider}!==${contract.provider}`);
  }
  if (observed.requestedModelId !== contract.modelId) {
    reasons.push(`requested_model_mismatch:${observed.requestedModelId}!==${contract.modelId}`);
  }
  if (!contract.immutableSnapshotPinned) {
    reasons.push('contract_snapshot_not_immutable');
  }
  if (!observed.responseModelId || !observed.responseModelId.trim()) {
    reasons.push('missing_response_model_id');
  } else if (observed.responseModelId !== contract.modelId) {
    reasons.push(`response_model_mismatch:${observed.responseModelId}!==${contract.modelId}`);
  }
  if (!observed.requestTimestampIso.trim()) {
    reasons.push('missing_request_timestamp');
  }
  return {
    status: reasons.length === 0 ? 'VERIFIED' : 'MODEL_PARITY_UNVERIFIED',
    reasons,
  };
}

function ceilDivMillion(tokens: number, microUsdPerMillion: number): number {
  assertSafeNonNegativeInteger(tokens, 'tokens');
  assertSafeNonNegativeInteger(microUsdPerMillion, 'microUsdPerMillion');
  if (tokens === 0 || microUsdPerMillion === 0) return 0;
  const product = BigInt(tokens) * BigInt(microUsdPerMillion);
  const roundedUp = (product + 999_999n) / 1_000_000n;
  const num = Number(roundedUp);
  return assertSafeNonNegativeInteger(num, 'computedCostMicroUsd');
}

export function computeConservativeCallCostMicroUsd(
  contract: PinnedModelPricingContract,
  maxPromptTokens: number,
  maxOutputTokens: number,
): number {
  const inputCost = ceilDivMillion(maxPromptTokens, contract.inputMicroUsdPerMillionTokens);
  const outputCost = ceilDivMillion(maxOutputTokens, contract.outputMicroUsdPerMillionTokens);
  return assertSafeNonNegativeInteger(inputCost + outputCost, 'conservativeCallCostMicroUsd');
}

export function computeObservedCallCostMicroUsd(
  contract: PinnedModelPricingContract,
  usage: {
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly cachedPromptTokens?: number;
  },
): number {
  const cached = usage.cachedPromptTokens ?? 0;
  assertSafeNonNegativeInteger(cached, 'cachedPromptTokens');
  assertSafeNonNegativeInteger(usage.promptTokens, 'promptTokens');
  if (cached > usage.promptTokens) {
    throw new Error(`cachedPromptTokens (${cached}) cannot exceed promptTokens (${usage.promptTokens})`);
  }
  const uncachedPrompt = usage.promptTokens - cached;
  const uncachedCost = ceilDivMillion(uncachedPrompt, contract.inputMicroUsdPerMillionTokens);
  const cachedCost = ceilDivMillion(cached, contract.cachedInputMicroUsdPerMillionTokens);
  const outputCost = ceilDivMillion(usage.completionTokens, contract.outputMicroUsdPerMillionTokens);
  return assertSafeNonNegativeInteger(uncachedCost + cachedCost + outputCost, 'observedCallCostMicroUsd');
}

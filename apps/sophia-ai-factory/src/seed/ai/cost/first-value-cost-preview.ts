/**
 * Deterministic cost preview contract for BASIC text-script first-value journey.
 *
 * Unlike the legacy router ranker, this module NEVER invents fallback pricing,
 * NEVER treats promotional or free credits as sustainable marginal cost, and
 * NEVER returns $0 when pricing is unavailable (returns COST_ESTIMATE_UNAVAILABLE).
 *
 * @module seed/ai/cost/first-value-cost-preview
 */

import type { ProviderId } from '../provider-interface';
import { MODEL_PRICING } from './rate-card-table';
import { estimateTokenCount } from './token-calculator';

export const STATIC_RATE_CARD_SOURCE =
  'sophia-static-rate-card:src/seed/ai/cost/rate-card-table.ts';
export const STATIC_RATE_CARD_UPDATED_AT = '2026-04-14T00:00:00.000Z';

const SYSTEM_PROMPT_OVERHEAD_TOKENS = 280;
const TOKENS_PER_SCRIPT_SECOND_MIN = 8;
const TOKENS_PER_SCRIPT_SECOND_MAX = 16;

export interface FirstValueCostPreviewInput {
  readonly provider: ProviderId | string | null;
  readonly model: string | null;
  readonly topic: string;
  readonly audience: string;
  readonly durationSec: number;
  readonly capabilitiesKnown?: 'probed' | 'inferred_from_provider_table' | 'unknown';
  readonly customRateCard?: Readonly<Record<string, { inputPer1MUsd: number; outputPer1MUsd: number }>>;
  readonly priceSource?: string;
  readonly priceUpdatedAt?: string;
}

export interface TokenAssumptions {
  readonly inputTokens: number;
  readonly outputTokensMin: number;
  readonly outputTokensMax: number;
  readonly durationSec: number;
}

export interface CostPreviewAvailable {
  readonly status: 'COST_ESTIMATE_AVAILABLE';
  readonly provider: string;
  readonly model: string;
  readonly tokenAssumptions: TokenAssumptions;
  readonly unitPricePer1MTokensUsd: {
    readonly input: number;
    readonly output: number;
  };
  readonly priceSource: string;
  readonly priceUpdatedAt: string;
  readonly estimatedCostRangeUsd: {
    readonly minUsd: number;
    readonly maxUsd: number;
  };
  readonly fundingResponsibility: 'customer_byok';
  readonly costBasis: 'estimated';
  readonly promotionalCreditsExcluded: true;
  readonly warnings: readonly string[];
}

export interface CostPreviewUnavailable {
  readonly status: 'COST_ESTIMATE_UNAVAILABLE';
  readonly provider: string | null;
  readonly model: string | null;
  readonly tokenAssumptions: TokenAssumptions;
  readonly unitPricePer1MTokensUsd: null;
  readonly priceSource: string | null;
  readonly priceUpdatedAt: string | null;
  readonly estimatedCostRangeUsd: null;
  readonly fundingResponsibility: 'customer_byok';
  readonly costBasis: 'unavailable';
  readonly promotionalCreditsExcluded: true;
  readonly reason: string;
  readonly warnings: readonly string[];
}

export type FirstValueCostPreview = CostPreviewAvailable | CostPreviewUnavailable;

function roundMicroUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function lookupExactTextRate(
  model: string,
  customRateCard?: Readonly<Record<string, { inputPer1MUsd: number; outputPer1MUsd: number }>>,
): { input: number; output: number } | null {
  if (customRateCard) {
    const custom = customRateCard[model];
    if (
      custom &&
      Number.isFinite(custom.inputPer1MUsd) &&
      Number.isFinite(custom.outputPer1MUsd) &&
      custom.inputPer1MUsd >= 0 &&
      custom.outputPer1MUsd >= 0
    ) {
      return { input: custom.inputPer1MUsd, output: custom.outputPer1MUsd };
    }
    return null;
  }

  const entry = MODEL_PRICING[model];
  if (!entry || entry.type !== 'text') {
    return null;
  }
  return { input: entry.input, output: entry.output };
}

/**
 * Computes a deterministic marginal-cost preview for one BASIC text script.
 * Returns `COST_ESTIMATE_UNAVAILABLE` (never `$0`) whenever model or rate data
 * cannot be established from the authoritative rate card.
 */
export function buildFirstValueCostPreview(
  input: FirstValueCostPreviewInput,
): FirstValueCostPreview {
  const safeDurationSec = Math.max(10, Math.min(300, Math.round(input.durationSec || 30)));
  const promptTokens = estimateTokenCount(`${input.topic} ${input.audience}`);
  const tokenAssumptions: TokenAssumptions = {
    inputTokens: SYSTEM_PROMPT_OVERHEAD_TOKENS + promptTokens,
    outputTokensMin: safeDurationSec * TOKENS_PER_SCRIPT_SECOND_MIN,
    outputTokensMax: safeDurationSec * TOKENS_PER_SCRIPT_SECOND_MAX,
    durationSec: safeDurationSec,
  };

  const warnings: string[] = [
    'Estimated marginal inference cost is billed directly to your BYOK provider account; promotional credits are excluded.',
  ];

  if (input.capabilitiesKnown === 'unknown' || input.capabilitiesKnown === 'inferred_from_provider_table') {
    warnings.push(
      'Model capabilities have not been live-probed for this key; verify structured JSON support before paid inference.',
    );
  }

  const provider = input.provider?.trim() || null;
  const model = input.model?.trim() || null;

  if (!provider || !model) {
    warnings.push('Provider or model is unknown; cost cannot be estimated.');
    return {
      status: 'COST_ESTIMATE_UNAVAILABLE',
      provider,
      model,
      tokenAssumptions,
      unitPricePer1MTokensUsd: null,
      priceSource: null,
      priceUpdatedAt: null,
      estimatedCostRangeUsd: null,
      fundingResponsibility: 'customer_byok',
      costBasis: 'unavailable',
      promotionalCreditsExcluded: true,
      reason: 'PROVIDER_OR_MODEL_UNKNOWN',
      warnings,
    };
  }

  const rate = lookupExactTextRate(model, input.customRateCard);
  if (!rate) {
    warnings.push(`No verified unit price found for model "${model}"; refusing to fabricate $0 or fallback pricing.`);
    return {
      status: 'COST_ESTIMATE_UNAVAILABLE',
      provider,
      model,
      tokenAssumptions,
      unitPricePer1MTokensUsd: null,
      priceSource: input.priceSource ?? null,
      priceUpdatedAt: input.priceUpdatedAt ?? null,
      estimatedCostRangeUsd: null,
      fundingResponsibility: 'customer_byok',
      costBasis: 'unavailable',
      promotionalCreditsExcluded: true,
      reason: 'PRICING_SOURCE_UNAVAILABLE',
      warnings,
    };
  }

  const inputUsd = (tokenAssumptions.inputTokens / 1_000_000) * rate.input;
  const minUsd = roundMicroUsd(inputUsd + (tokenAssumptions.outputTokensMin / 1_000_000) * rate.output);
  const maxUsd = roundMicroUsd(inputUsd + (tokenAssumptions.outputTokensMax / 1_000_000) * rate.output);

  return {
    status: 'COST_ESTIMATE_AVAILABLE',
    provider,
    model,
    tokenAssumptions,
    unitPricePer1MTokensUsd: rate,
    priceSource: input.priceSource ?? STATIC_RATE_CARD_SOURCE,
    priceUpdatedAt: input.priceUpdatedAt ?? STATIC_RATE_CARD_UPDATED_AT,
    estimatedCostRangeUsd: { minUsd, maxUsd },
    fundingResponsibility: 'customer_byok',
    costBasis: 'estimated',
    promotionalCreditsExcluded: true,
    warnings,
  };
}

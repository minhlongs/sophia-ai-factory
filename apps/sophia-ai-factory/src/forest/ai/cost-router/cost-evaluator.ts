/**
 * Cost Evaluation and Provider Selection Logic
 *
 * @module forest/ai/cost-router/cost-evaluator
 */

import type {
  ProviderId,
  ChatMessage,
  ChatOptions,
} from '@/seed/ai/provider-interface';
import { estimateCostV2 } from '@/seed/ai/cost-estimator';
import { selectRoute, classifyComplexity, type Complexity } from '../llm-router';
import {
  TIER_COST_LIMITS,
  type UserTier,
  type CostAwareRouteDecision,
  type ProviderChainEntry,
} from './types';

const FALLBACK_MODELS: Record<ProviderId, string> = {
  openrouter: 'openai/gpt-4o-mini',
  anthropic: 'claude-haiku-3-5',
  elevenlabs: 'elevenlabs/eleven_turbo_v2_5',
  wan: 'wan/wan-2-1-t2v',
  'fish-speech': 'fish-speech/fish-speech-1-5',
};

/**
 * Gets default model for a provider given a complexity level.
 */
export function getDefaultModel(providerId: ProviderId, complexity: Complexity): string {
  const route = selectRoute(complexity);
  if (route.provider === providerId) return route.model;
  return FALLBACK_MODELS[providerId] ?? 'openai/gpt-4o-mini';
}

/**
 * Select the best provider from the chain based on cost + health.
 *
 * Ranking rules (when preferCheaper is true):
 * - Metered providers: sort by `usd` ascending.
 * - Unknown / Unmetered providers: treated as (cheapestMeteredCost + epsilon)
 *   so they never rank below the cheapest metered provider.
 */
export function selectCostAwareProvider(params: {
  chain: ProviderChainEntry[];
  messages: ChatMessage[];
  options: ChatOptions;
  complexity: Complexity;
  preferCheaper: boolean;
  userTier: UserTier;
}): CostAwareRouteDecision {
  const { chain, messages, options, complexity, preferCheaper, userTier } = params;
  const routeDecision = selectRoute(complexity);

  const estimates = chain.map((entry) => {
    const model =
      entry.id === routeDecision.provider
        ? options.model ?? routeDecision.model
        : getDefaultModel(entry.id, complexity);

    const costV2 = estimateCostV2(messages, model, { providerId: entry.id });
    return {
      id: entry.id,
      model,
      estimatedCost: costV2.usd,
      costKind: costV2.kind,
      health: entry.health,
      capabilities: entry.provider.getCapabilities(model),
    };
  });

  const meteredCosts = estimates
    .filter((e) => e.costKind === 'metered')
    .map((e) => e.estimatedCost);
  const cheapestMeteredCost = meteredCosts.length > 0 ? Math.min(...meteredCosts) : 0;

  const EPSILON = 0.000001; // 1 micro-dollar
  const rankCost = (e: (typeof estimates)[number]): number => {
    switch (e.costKind) {
      case 'metered':
        return e.estimatedCost;
      case 'unknown':
      case 'unmetered':
        return cheapestMeteredCost + EPSILON;
      default:
        return e.estimatedCost;
    }
  };

  const sorted = preferCheaper
    ? [...estimates].sort((a, b) => rankCost(a) - rankCost(b))
    : estimates;

  const selected = sorted[0] ?? estimates[0];

  const usedCheaperAlternative =
    selected.id !== routeDecision.provider ||
    selected.estimatedCost <
      (estimates.find((e) => e.id === routeDecision.provider)?.estimatedCost ?? Infinity);

  const exceedsTierLimit = selected.estimatedCost > TIER_COST_LIMITS[userTier];

  const primaryEstimate = estimates.find((e) => e.id === routeDecision.provider)?.estimatedCost;
  const reason = usedCheaperAlternative
    ? `cheaper_alternative:${selected.id} ($${selected.estimatedCost.toFixed(6)} vs $${primaryEstimate !== undefined ? primaryEstimate.toFixed(6) : 'N/A'})`
    : `primary:${selected.id} ($${selected.estimatedCost.toFixed(6)})`;

  return {
    providerId: selected.id,
    model: selected.model,
    complexity,
    usedCheaperAlternative,
    estimatedCost: selected.estimatedCost,
    exceedsTierLimit,
    reason,
  };
}

/**
 * Finds a cheaper provider within a cost budget.
 */
export function findCheaperProvider(
  chain: ProviderChainEntry[],
  messages: ChatMessage[],
  options: ChatOptions,
  budget: number,
): { id: ProviderId; model: string; estimatedCost: number } | null {
  for (const entry of chain) {
    const model = getDefaultModel(entry.id, classifyComplexity(''));
    const cost = entry.provider.estimateCost(messages, model, options);

    if (cost <= budget) {
      return { id: entry.id, model, estimatedCost: cost };
    }
  }

  return null;
}

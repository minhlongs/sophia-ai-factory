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
import { selectRoute, classifyComplexity, type Complexity } from '../llm-router';
import {
  TIER_COST_LIMITS,
  type UserTier,
  type CostAwareRouteDecision,
  type ProviderChainEntry,
} from './types';
import {
  getDefaultModel,
  estimateAndSortProviderChain,
} from './cost-estimator-ranker';

export { getDefaultModel };

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

  const { estimates, sorted } = estimateAndSortProviderChain({
    chain,
    messages,
    options,
    complexity,
    preferCheaper,
    primaryProvider: routeDecision.provider,
    primaryModel: routeDecision.model,
  });

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

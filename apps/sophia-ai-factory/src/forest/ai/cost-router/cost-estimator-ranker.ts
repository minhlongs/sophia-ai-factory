/**
 * Default model lookup and cost ranking helpers for the cost-aware router.
 *
 * @module forest/ai/cost-router/cost-estimator-ranker
 */

import type {
  ProviderId,
  ChatMessage,
  ChatOptions,
} from '@/seed/ai/provider-interface';
import { estimateCostV2 } from '@/seed/ai/cost-estimator';
import { selectRoute, type Complexity } from '../llm-router';
import type { ProviderChainEntry } from './types';

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

export function estimateAndSortProviderChain(params: {
  chain: ProviderChainEntry[];
  messages: ChatMessage[];
  options: ChatOptions;
  complexity: Complexity;
  preferCheaper: boolean;
  primaryProvider: ProviderId;
  primaryModel: string;
}) {
  const { chain, messages, options, complexity, preferCheaper, primaryProvider, primaryModel } = params;

  const estimates = chain.map((entry) => {
    const model =
      entry.id === primaryProvider
        ? options.model ?? primaryModel
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

  return { estimates, sorted };
}

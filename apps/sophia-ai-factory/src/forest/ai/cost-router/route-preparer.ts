/**
 * Route Preparation Helper for Cost-Aware Router
 *
 * @module forest/ai/cost-router/route-preparer
 */

import type { ChatMessage, ChatOptions } from '@/seed/ai/provider-interface';
import type { ProviderRegistry } from '@/seed/ai/provider-registry';
import { classifyComplexity, selectRoute } from '../llm-router';
import { selectCostAwareProvider } from './cost-evaluator';
import type {
  CostAwareRouteDecision,
  ProviderChainEntry,
  UserTier,
} from './types';

export interface PreparedCostRoute {
  complexity: ReturnType<typeof classifyComplexity>;
  chain: ProviderChainEntry[];
  costDecision: CostAwareRouteDecision;
  adjustedOptions: ChatOptions;
}

export function prepareCostAwareRoute(params: {
  prompt: string;
  messages: ChatMessage[];
  options: ChatOptions;
  registry: ProviderRegistry;
  preferCheaper: boolean;
  userTier: UserTier;
}): PreparedCostRoute {
  const { prompt, messages, options, registry, preferCheaper, userTier } = params;
  const complexity = classifyComplexity(prompt);
  const routeDecision = selectRoute(complexity);
  const chain = registry.getFallbackChain(routeDecision.provider) as ProviderChainEntry[];

  if (chain.length === 0) {
    throw new Error('No healthy providers available');
  }

  const costDecision = selectCostAwareProvider({
    chain,
    messages,
    options,
    complexity,
    preferCheaper,
    userTier,
  });

  const adjustedOptions: ChatOptions = { ...options, model: costDecision.model };

  return {
    complexity,
    chain,
    costDecision,
    adjustedOptions,
  };
}

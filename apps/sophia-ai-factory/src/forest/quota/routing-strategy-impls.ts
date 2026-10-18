/**
 * Concrete RouterStrategy implementations for provider pool selection.
 *
 * Layer: forest/quota
 * @module forest/quota/routing-strategy-impls
 */

import {
  PROVIDER_PRIORITY,
  type ProviderCandidate,
  type RouterStrategy,
  type RoutingContext,
  type RoutingDecision,
  type StrategyName,
  type VideoProvider,
  type VideoTaskType,
} from '@/seed/config/routing-strategies';

/** Thrown by a strategy when the pool has no providers for the task. */
export class NoProvidersAvailableError extends Error {
  constructor(taskType: VideoTaskType) {
    super(`No AI provider available for task '${taskType}'`);
    this.name = 'NoProvidersAvailableError';
  }
}

/** Priority position of a provider for a task (0 = highest). */
function priorityIndex(provider: VideoProvider, taskType: VideoTaskType): number {
  const order = PROVIDER_PRIORITY[taskType];
  const index = order.indexOf(provider);
  return index === -1 ? order.length : index;
}

/** Order a pool by recommended priority for a task. */
function byPriority(taskType: VideoTaskType): (a: ProviderCandidate, b: ProviderCandidate) => number {
  return (a, b) => priorityIndex(a.provider, taskType) - priorityIndex(b.provider, taskType);
}

/** Picks the first provider in the recommended priority order. Default strategy. */
export class PriorityStrategy implements RouterStrategy {
  readonly name: StrategyName = 'priority';
  readonly description = 'Selects the first available provider in the recommended order for the task';

  select(pool: ProviderCandidate[], context: RoutingContext): RoutingDecision {
    if (pool.length === 0) throw new NoProvidersAvailableError(context.taskType);
    const chosen = [...pool].sort(byPriority(context.taskType))[0];
    return {
      provider: chosen.provider,
      model: chosen.model,
      strategy: 'priority',
      reason: `PriorityStrategy: ${chosen.provider} first in priority order for ${context.taskType}`,
      candidatesConsidered: pool.length,
    };
  }
}

/** Picks the cheapest available provider for the task. */
export class CostOptimizedStrategy implements RouterStrategy {
  readonly name: StrategyName = 'cost-optimized';
  readonly description = 'Selects the cheapest available provider for the task';

  select(pool: ProviderCandidate[], context: RoutingContext): RoutingDecision {
    if (pool.length === 0) throw new NoProvidersAvailableError(context.taskType);
    // Stable sort: equal costs keep buildProviderPool's priority order.
    const chosen = [...pool].sort((a, b) => a.estimatedCost - b.estimatedCost)[0];
    return {
      provider: chosen.provider,
      model: chosen.model,
      strategy: 'cost-optimized',
      reason: `CostOptimizedStrategy: ${chosen.provider} cheapest at $${chosen.estimatedCost.toFixed(4)}`,
      candidatesConsidered: pool.length,
    };
  }
}

/** Picks the provider with the lowest recent usage (load balancing). */
export class LeastUsedStrategy implements RouterStrategy {
  readonly name: StrategyName = 'least-used';
  readonly description = 'Selects the provider with the lowest recent usage (load balancing)';

  select(pool: ProviderCandidate[], context: RoutingContext): RoutingDecision {
    if (pool.length === 0) throw new NoProvidersAvailableError(context.taskType);
    // Stable sort: equal usage keeps buildProviderPool's priority order.
    const chosen = [...pool].sort((a, b) => a.usageCount - b.usageCount)[0];
    return {
      provider: chosen.provider,
      model: chosen.model,
      strategy: 'least-used',
      reason: `LeastUsedStrategy: ${chosen.provider} least used (${chosen.usageCount} this window)`,
      candidatesConsidered: pool.length,
    };
  }
}

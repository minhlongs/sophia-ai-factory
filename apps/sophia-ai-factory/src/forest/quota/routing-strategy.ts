/**
 * Concrete RouterStrategy implementations + registry.
 *
 * Forest layer: strategies are pure and synchronous — they rank an
 * already-built provider pool. Async work (BYOK key resolution, quota
 * checks) happens in buildProviderPool (provider-pool.ts) before select()
 * is called, so every strategy is trivially testable.
 *
 * Modeled on OmniRoute's routerStrategy registry, simplified to Sophia's
 * three strategies and auto-registered at module load (CF Workers forbids
 * dynamic imports).
 */

import {
  DEFAULT_STRATEGY,
  PROVIDER_PRIORITY,
  STRATEGY_NAMES,
  type ProviderCandidate,
  type RouterStrategy,
  type RoutingContext,
  type RoutingDecision,
  type StrategyName,
  type VideoProvider,
  type VideoTaskType,
} from '@/seed/config/routing-strategies';
import { logger } from '@/seed/utils/logger-utility';

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
class PriorityStrategy implements RouterStrategy {
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
class CostOptimizedStrategy implements RouterStrategy {
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
class LeastUsedStrategy implements RouterStrategy {
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

const priorityStrategy = new PriorityStrategy();

/** Auto-registered strategies, available before any caller runs. */
const strategyRegistry = new Map<StrategyName, RouterStrategy>([
  ['priority', priorityStrategy],
  ['cost-optimized', new CostOptimizedStrategy()],
  ['least-used', new LeastUsedStrategy()],
]);

/** Register or replace a strategy by name (warns on overwrite). */
export function registerStrategy(name: StrategyName, strategy: RouterStrategy): void {
  if (strategyRegistry.has(name)) {
    logger.warn(`routing-strategy: overwriting registered strategy '${name}'`);
  }
  strategyRegistry.set(name, strategy);
}

/** Resolve a strategy by name, falling back to the default for unknown names. */
export function getStrategy(name?: string): RouterStrategy {
  const candidate = name as StrategyName;
  if (!STRATEGY_NAMES.includes(candidate)) return priorityStrategy;
  return strategyRegistry.get(candidate) ?? priorityStrategy;
}

/** List registered strategies with descriptions. */
export function listStrategies(): Array<{ name: StrategyName; description: string }> {
  return [...strategyRegistry.values()].map((s) => ({ name: s.name, description: s.description }));
}

/** Select a provider for the task using the named strategy (default: priority). */
export function selectWithStrategy(
  pool: ProviderCandidate[],
  context: RoutingContext,
  strategyName?: string,
): RoutingDecision {
  return getStrategy(strategyName).select(pool, context);
}

export { DEFAULT_STRATEGY };

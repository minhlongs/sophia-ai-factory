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
  STRATEGY_NAMES,
  type ProviderCandidate,
  type RouterStrategy,
  type RoutingContext,
  type RoutingDecision,
  type StrategyName,
} from '@/seed/config/routing-strategies';
import { logger } from '@/seed/utils/logger-utility';
import {
  CostOptimizedStrategy,
  LeastUsedStrategy,
  NoProvidersAvailableError,
  PriorityStrategy,
} from './routing-strategy-impls';

export { NoProvidersAvailableError, DEFAULT_STRATEGY };

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

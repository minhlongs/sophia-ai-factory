/**
 * Budget Guard and Governance Helper for Cost Router
 *
 * @module forest/ai/cost-router/budget-guard
 */

import type { ChatMessage, ChatOptions } from '@/seed/ai/provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import { BudgetTracker, BudgetMode } from '@/tree/budget';
import { findCheaperProvider } from './cost-evaluator';
import {
  TIER_COST_LIMITS,
  type CostAwareRouterOptions,
  type CostAwareRouteDecision,
  type ProviderChainEntry,
  type UserTier,
} from './types';

/**
 * Creates budget tracker instance if configured in options.
 */
export function createBudgetTracker(options: CostAwareRouterOptions): BudgetTracker | null {
  if (options.tenantId && options.budgetTotalUsd != null) {
    return new BudgetTracker(options.tenantId, {
      budgetTotalUsd: options.budgetTotalUsd,
      reservePct: options.budgetReservePct ?? 0.1,
      mode: options.budgetMode ?? BudgetMode.WARN,
    });
  }
  return null;
}

/**
 * Handles budget estimation, reservation, and fallback to cheaper provider on failure.
 */
export function handleBudgetReservation(params: {
  budgetTracker: BudgetTracker | null;
  costDecision: CostAwareRouteDecision;
  chain: ProviderChainEntry[];
  messages: ChatMessage[];
  adjustedOptions: ChatOptions;
}): { entryId?: string } {
  const { budgetTracker, costDecision, chain, messages, adjustedOptions } = params;
  if (!budgetTracker) return {};

  let entryId = budgetTracker.estimate(
    costDecision.providerId,
    'chat',
    costDecision.estimatedCost,
  );

  try {
    budgetTracker.reserve(entryId);
    return { entryId };
  } catch (err) {
    logger.warn('[CostAwareRouter] Budget reserve failed — attempting cheaper provider', {
      error: err instanceof Error ? err.message : String(err),
      estimatedCost: costDecision.estimatedCost,
      providerId: costDecision.providerId,
    });

    const cheaperProvider = findCheaperProvider(
      chain,
      messages,
      adjustedOptions,
      budgetTracker.usableBudgetUsd,
    );

    if (cheaperProvider) {
      logger.info('[CostAwareRouter] Fell back to cheaper provider due to budget', {
        originalProvider: costDecision.providerId,
        originalCost: costDecision.estimatedCost,
        cheaperProvider: cheaperProvider.id,
        cheaperCost: cheaperProvider.estimatedCost,
      });

      adjustedOptions.model = cheaperProvider.model;
      budgetTracker.refund(entryId);
      entryId = budgetTracker.estimate(cheaperProvider.id, 'chat', cheaperProvider.estimatedCost);
      budgetTracker.reserve(entryId);
      return { entryId };
    }

    throw err;
  }
}

/**
 * Enforces user tier cost limits and downgrades to cheaper provider if needed.
 */
export function enforceTierLimit(params: {
  userTier: UserTier;
  enforceCostLimits: boolean;
  costDecision: CostAwareRouteDecision;
  chain: ProviderChainEntry[];
  messages: ChatMessage[];
  adjustedOptions: ChatOptions;
  budgetTracker: BudgetTracker | null;
  entryId?: string;
}): { entryId?: string } {
  const {
    userTier,
    enforceCostLimits,
    costDecision,
    chain,
    messages,
    adjustedOptions,
    budgetTracker,
  } = params;

  let currentEntryId = params.entryId;
  const tierLimit = TIER_COST_LIMITS[userTier];

  if (enforceCostLimits && costDecision.estimatedCost > tierLimit) {
    logger.warn('[CostAwareRouter] Request exceeds tier limit', undefined, {
      userTier,
      tierLimit,
      estimatedCost: costDecision.estimatedCost,
      providerId: costDecision.providerId,
      model: costDecision.model,
    });

    const cheaperProvider = findCheaperProvider(chain, messages, adjustedOptions, tierLimit);
    if (cheaperProvider) {
      logger.info('[CostAwareRouter] Downgraded to cheaper provider to stay within tier limit', undefined, {
        originalProvider: costDecision.providerId,
        originalCost: costDecision.estimatedCost,
        cheaperProvider: cheaperProvider.id,
        cheaperCost: cheaperProvider.estimatedCost,
        userTier,
        tierLimit,
      });

      adjustedOptions.model = cheaperProvider.model;

      if (budgetTracker && currentEntryId) {
        budgetTracker.refund(currentEntryId);
        currentEntryId = budgetTracker.estimate(
          cheaperProvider.id,
          'chat',
          cheaperProvider.estimatedCost,
        );
        budgetTracker.reserve(currentEntryId);
      }
    }
  }

  return { entryId: currentEntryId };
}

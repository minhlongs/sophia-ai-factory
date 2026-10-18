/**
 * Tier Cost Limit Enforcement for Cost Router
 *
 * @module forest/ai/cost-router/budget-guard-tier
 */

import type { ChatMessage, ChatOptions } from '@/seed/ai/provider-interface';
import { logger } from '@/seed/utils/logger-utility';
import type { BudgetTracker } from '@/tree/budget';
import { findCheaperProvider } from './cost-evaluator';
import {
  TIER_COST_LIMITS,
  type CostAwareRouteDecision,
  type ProviderChainEntry,
  type UserTier,
} from './types';

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

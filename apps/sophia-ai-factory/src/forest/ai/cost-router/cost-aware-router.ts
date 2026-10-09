/**
 * Cost-Aware Router Class Implementation
 *
 * @module forest/ai/cost-router/cost-aware-router
 */

import type {
  ChatMessage,
  ChatOptions,
  StreamChunk,
} from '@/seed/ai/provider-interface';
import type { ProviderRegistry } from '@/seed/ai/provider-registry';
import { logger } from '@/seed/utils/logger-utility';
import { classifyComplexity, selectRoute } from '../llm-router';
import type { MultiProviderRouter, RoutedChatResult } from '../multi-provider-router';
import type { BudgetTracker } from '@/tree/budget';
import {
  TIER_COST_LIMITS,
  type UserTier,
  type CostAwareRouterOptions,
  type CostAwareRouteDecision,
  type ProviderChainEntry,
} from './types';
import { selectCostAwareProvider, findCheaperProvider } from './cost-evaluator';
import { createBudgetTracker, handleBudgetReservation, enforceTierLimit } from './budget-guard';

export class CostAwareRouter {
  private readonly router: MultiProviderRouter;
  private readonly registry: ProviderRegistry;
  private readonly userTier: UserTier;
  private readonly enforceCostLimits: boolean;
  private readonly preferCheaper: boolean;
  private readonly maxCostRatio: number;
  private readonly budgetTracker: BudgetTracker | null;

  constructor(options: CostAwareRouterOptions) {
    this.router = options.router;
    this.registry = options.registry;
    this.userTier = options.userTier ?? 'BASIC';
    this.enforceCostLimits = options.enforceCostLimits ?? true;
    this.preferCheaper = options.preferCheaper ?? true;
    this.maxCostRatio = options.maxCostRatio ?? 3.0;
    this.budgetTracker = createBudgetTracker(options);
  }

  /**
   * Route and execute a chat request with cost awareness.
   */
  async chat(prompt: string, messages: ChatMessage[], options: ChatOptions): Promise<RoutedChatResult> {
    const complexity = classifyComplexity(prompt);
    const routeDecision = selectRoute(complexity);
    const chain = this.registry.getFallbackChain(routeDecision.provider) as ProviderChainEntry[];

    if (chain.length === 0) {
      throw new Error('No healthy providers available');
    }

    const costDecision = selectCostAwareProvider({
      chain,
      messages,
      options,
      complexity,
      preferCheaper: this.preferCheaper,
      userTier: this.userTier,
    });

    const adjustedOptions: ChatOptions = { ...options, model: costDecision.model };

    let { entryId } = handleBudgetReservation({
      budgetTracker: this.budgetTracker,
      costDecision,
      chain,
      messages,
      adjustedOptions,
    });

    const tierLimitResult = enforceTierLimit({
      userTier: this.userTier,
      enforceCostLimits: this.enforceCostLimits,
      costDecision,
      chain,
      messages,
      adjustedOptions,
      budgetTracker: this.budgetTracker,
      entryId,
    });
    entryId = tierLimitResult.entryId;

    const tierLimit = TIER_COST_LIMITS[this.userTier];
    logger.info('[CostAwareRouter] Routing decision', undefined, {
      providerId: costDecision.providerId,
      model: costDecision.model,
      estimatedCost: costDecision.estimatedCost,
      complexity,
      usedCheaperAlternative: costDecision.usedCheaperAlternative,
      reason: costDecision.reason,
      userTier: this.userTier,
      tierLimit,
    });

    let actualCost = 0;
    try {
      const result = await this.router.chat(prompt, messages, adjustedOptions);
      actualCost = result.estimatedCost;
      if (this.budgetTracker && entryId) {
        this.budgetTracker.reconcile(entryId, actualCost, true);
      }
      return result;
    } catch (err) {
      if (this.budgetTracker && entryId) {
        this.budgetTracker.reconcile(entryId, actualCost, false);
      }
      throw err;
    }
  }

  /**
   * Stream a chat request with cost awareness.
   */
  async *stream(
    prompt: string,
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk & { costMetadata?: CostAwareRouteDecision }, void, unknown> {
    const complexity = classifyComplexity(prompt);
    const routeDecision = selectRoute(complexity);
    const chain = this.registry.getFallbackChain(routeDecision.provider) as ProviderChainEntry[];

    if (chain.length === 0) {
      throw new Error('No healthy providers available');
    }

    const costDecision = selectCostAwareProvider({
      chain,
      messages,
      options,
      complexity,
      preferCheaper: this.preferCheaper,
      userTier: this.userTier,
    });

    const adjustedOptions: ChatOptions = { ...options, model: costDecision.model };
    const tierLimit = TIER_COST_LIMITS[this.userTier];

    if (this.enforceCostLimits && costDecision.estimatedCost > tierLimit) {
      const cheaperProvider = findCheaperProvider(chain, messages, adjustedOptions, tierLimit);
      if (cheaperProvider) {
        adjustedOptions.model = cheaperProvider.model;
      }
    }

    yield {
      type: 'text_delta',
      delta: '',
      done: false,
      costMetadata: costDecision,
    };

    yield* this.router.stream(prompt, messages, adjustedOptions);
  }
}

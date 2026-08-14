/**
 * @module forest/ai/cost-aware-router
 *
 * Cost-aware routing extension for the multi-provider router.
 *
 * Considers token cost, user tier limits, and provider health when
 * selecting a provider. Falls back to cheaper providers when the
 * preferred provider would exceed budget or when a cheaper healthy
 * alternative is available.
 *
 * Integrates with BudgetTracker (tree/budget) for the
 * estimate → reserve → reconcile → refund flow around LLM calls.
 *
 * Layer rule: forest — imports seed + tree.
 */

import type {
  ProviderId,
  ChatMessage,
  ChatOptions,
  StreamChunk,
} from '@/seed/ai/provider-interface';
import { ProviderRegistry } from '@/seed/ai/provider-registry';
import { logger } from '@/seed/utils/logger-utility';
import { classifyComplexity, selectRoute, type Complexity } from './llm-router';
import type { MultiProviderRouter, RoutedChatResult } from './multi-provider-router';
import { BudgetTracker, BudgetMode } from '@/tree/budget';

// ── Types ──────────────────────────────────────────────────────────────────────

/** User tier for cost limit enforcement. */
export type UserTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

/** Cost limits per user tier (USD per request). */
export const TIER_COST_LIMITS: Record<UserTier, number> = {
  BASIC: 0.05,
  PREMIUM: 0.50,
  ENTERPRISE: 2.00,
  MASTER: 10.00,
};

/** Options for cost-aware routing. */
export interface CostAwareRouterOptions {
  /** The underlying multi-provider router. */
  router: MultiProviderRouter;
  /** The provider registry for health + cost lookups. */
  registry: ProviderRegistry;
  /** User tier for cost limit enforcement. */
  userTier?: UserTier;
  /** Whether to enforce cost limits (skip expensive providers). */
  enforceCostLimits?: boolean;
  /** Whether to prefer cheaper providers when quality is equivalent. */
  preferCheaper?: boolean;
  /** Maximum cost ratio compared to the cheapest available option. */
  maxCostRatio?: number;
  /** Tenant ID for budget tracking (enables budget governance when provided). */
  tenantId?: string;
  /** Total budget ceiling in USD (requires tenantId). */
  budgetTotalUsd?: number;
  /** Budget mode: WARN | CAP | OBSERVE (requires tenantId). */
  budgetMode?: BudgetMode;
  /** Fraction of budget held back as reserve buffer (default 0.10). */
  budgetReservePct?: number;
}

/** Result of cost-aware routing decision. */
export interface CostAwareRouteDecision {
  /** Selected provider id. */
  providerId: ProviderId;
  /** Model to use. */
  model: string;
  /** Complexity classification. */
  complexity: Complexity;
  /** Whether a cheaper-than-preferred provider was selected. */
  usedCheaperAlternative: boolean;
  /** Estimated cost in USD. */
  estimatedCost: number;
  /** Whether the request would exceed the user's tier limit. */
  exceedsTierLimit: boolean;
  /** Reason for the routing decision. */
  reason: string;
}

// ── Cost-aware router ──────────────────────────────────────────────────────────

/**
 * Cost-aware routing extension.
 *
 * Wraps a MultiProviderRouter and adds cost-based provider selection:
 * - Estimates cost before sending
 * - Enforces user tier limits
 * - Prefers cheaper providers when quality is equivalent
 * - Integrates with BudgetTracker for tenant-scoped budget governance
 * - Logs cost per request for auditing
 *
 * Usage:
 * ```ts
 * const costRouter = new CostAwareRouter({
 *   router: multiProviderRouter,
 *   registry,
 *   userTier: 'PREMIUM',
 *   enforceCostLimits: true,
 *   tenantId: 'org-123',
 *   budgetTotalUsd: 10.0,
 *   budgetMode: BudgetMode.CAP,
 * });
 * const result = await costRouter.chat(prompt, messages, options);
 * ```
 */
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

    // Initialise BudgetTracker only when tenantId + budgetTotalUsd are provided
    if (options.tenantId && options.budgetTotalUsd != null) {
      this.budgetTracker = new BudgetTracker(options.tenantId, {
        budgetTotalUsd: options.budgetTotalUsd,
        reservePct: options.budgetReservePct ?? 0.1,
        mode: options.budgetMode ?? BudgetMode.WARN,
      });
    } else {
      this.budgetTracker = null;
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Route and execute a chat request with cost awareness.
   *
   * Selects the cheapest healthy provider that meets quality
   * requirements and stays within the user's tier budget.
   *
   * When budget tracking is enabled (tenantId + budgetTotalUsd set),
   * the flow is: estimate → reserve → execute → reconcile.
   *
   * @param prompt — User prompt (for complexity classification).
   * @param messages — Conversation messages.
   * @param options — Chat options (model, apiKey, etc.).
   * @returns Routed result with cost metadata.
   */
  async chat(prompt: string, messages: ChatMessage[], options: ChatOptions): Promise<RoutedChatResult> {
    const complexity = classifyComplexity(prompt);
    const routeDecision = selectRoute(complexity);

    // Get the fallback chain (health-aware)
    const chain = this.registry.getFallbackChain(routeDecision.provider);

    if (chain.length === 0) {
      throw new Error('No healthy providers available');
    }

    // Select provider based on cost + health
    const costDecision = this.selectCostAwareProvider(chain, messages, options, complexity);

    // Override the model in options if we selected a different provider
    const adjustedOptions: ChatOptions = {
      ...options,
      model: costDecision.model,
    };

    // ── Budget governance: estimate + reserve ────────────────────────────────
    let entryId: string | undefined;
    if (this.budgetTracker) {
      entryId = this.budgetTracker.estimate(
        costDecision.providerId,
        'chat',
        costDecision.estimatedCost,
      );
      try {
        this.budgetTracker.reserve(entryId);
      } catch (err) {
        logger.warn('[CostAwareRouter] Budget reserve failed — attempting cheaper provider', {
          error: err instanceof Error ? err.message : String(err),
          estimatedCost: costDecision.estimatedCost,
          providerId: costDecision.providerId,
        });
        // Try to find a cheaper provider within budget
        const cheaperProvider = this.findCheaperProvider(
          chain,
          messages,
          adjustedOptions,
          this.budgetTracker.usableBudgetUsd,
        );
        if (cheaperProvider) {
          logger.info('[CostAwareRouter] Fell back to cheaper provider due to budget', {
            originalProvider: costDecision.providerId,
            originalCost: costDecision.estimatedCost,
            cheaperProvider: cheaperProvider.id,
            cheaperCost: cheaperProvider.estimatedCost,
          });
          adjustedOptions.model = cheaperProvider.model;
          // Re-estimate with cheaper provider
          if (entryId) this.budgetTracker.refund(entryId);
          entryId = this.budgetTracker.estimate(cheaperProvider.id, 'chat', cheaperProvider.estimatedCost);
          this.budgetTracker.reserve(entryId);
        } else {
          // Re-throw the original budget error
          throw err;
        }
      }
    }

    // Check tier limit
    const tierLimit = TIER_COST_LIMITS[this.userTier];
    if (this.enforceCostLimits && costDecision.estimatedCost > tierLimit) {
      logger.warn('[CostAwareRouter] Request exceeds tier limit', undefined, {
        userTier: this.userTier,
        tierLimit,
        estimatedCost: costDecision.estimatedCost,
        providerId: costDecision.providerId,
        model: costDecision.model,
      });

      // Try to find a cheaper provider within the limit
      const cheaperProvider = this.findCheaperProvider(chain, messages, adjustedOptions, tierLimit);
      if (cheaperProvider) {
        logger.info('[CostAwareRouter] Downgraded to cheaper provider to stay within tier limit', undefined, {
          originalProvider: costDecision.providerId,
          originalCost: costDecision.estimatedCost,
          cheaperProvider: cheaperProvider.id,
          cheaperCost: cheaperProvider.estimatedCost,
          userTier: this.userTier,
          tierLimit,
        });

        adjustedOptions.model = cheaperProvider.model;
        // Re-estimate with cheaper provider for budget tracking
        if (this.budgetTracker && entryId) {
          this.budgetTracker.refund(entryId);
          entryId = this.budgetTracker.estimate(cheaperProvider.id, 'chat', cheaperProvider.estimatedCost);
          this.budgetTracker.reserve(entryId);
        }
      }
    }

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

    // ── Execute ──────────────────────────────────────────────────────────────
    let actualCost = 0;
    let _success = false;

    try {
      const result = await this.router.chat(prompt, messages, adjustedOptions);
      actualCost = result.estimatedCost;
      _success = true;

      // ── Budget governance: reconcile ───────────────────────────────────────
      if (this.budgetTracker && entryId) {
        this.budgetTracker.reconcile(entryId, actualCost, true);
      }

      return result;
    } catch (err) {
      // ── Budget governance: reconcile failure ───────────────────────────────
      if (this.budgetTracker && entryId) {
        this.budgetTracker.reconcile(entryId, actualCost, false);
      }
      throw err;
    }
  }

  /**
   * Stream a chat request with cost awareness.
   *
   * @param prompt — User prompt.
   * @param messages — Conversation messages.
   * @param options — Chat options.
   * @yields StreamChunk with cost metadata.
   */
  async *stream(
    prompt: string,
    messages: ChatMessage[],
    options: ChatOptions,
  ): AsyncGenerator<StreamChunk & { costMetadata?: CostAwareRouteDecision }, void, unknown> {
    const complexity = classifyComplexity(prompt);
    const routeDecision = selectRoute(complexity);
    const chain = this.registry.getFallbackChain(routeDecision.provider);

    if (chain.length === 0) {
      throw new Error('No healthy providers available');
    }

    const costDecision = this.selectCostAwareProvider(chain, messages, options, complexity);
    const adjustedOptions: ChatOptions = { ...options, model: costDecision.model };

    const tierLimit = TIER_COST_LIMITS[this.userTier];
    if (this.enforceCostLimits && costDecision.estimatedCost > tierLimit) {
      const cheaperProvider = this.findCheaperProvider(chain, messages, adjustedOptions, tierLimit);
      if (cheaperProvider) {
        adjustedOptions.model = cheaperProvider.model;
      }
    }

    // Yield initial metadata chunk
    yield {
      type: 'text_delta',
      delta: '',
      done: false,
      costMetadata: costDecision,
    };

    // Delegate to underlying router for actual streaming
    yield* this.router.stream(prompt, messages, adjustedOptions);
  }

  // ── Provider selection ──────────────────────────────────────────────────────

  /**
   * Select the best provider from the chain based on cost + health.
   */
  private selectCostAwareProvider(
    chain: Array<{
      id: ProviderId;
      provider: {
        estimateCost: (messages: ChatMessage[], model: string, options?: ChatOptions) => number;
        getCapabilities: (model: string) => { maxOutputTokens: number };
      };
      health: { avgLatencyMs: number };
    }>,
    messages: ChatMessage[],
    options: ChatOptions,
    complexity: Complexity,
  ): CostAwareRouteDecision {
    const routeDecision = selectRoute(complexity);

    // Estimate cost for each provider in the chain
    const estimates = chain.map((entry) => {
      const model =
        entry.id === routeDecision.provider
          ? options.model ?? routeDecision.model
          : this.getDefaultModel(entry.id, complexity);

      const estimatedCost = entry.provider.estimateCost(messages, model, options);
      return {
        id: entry.id,
        model,
        estimatedCost,
        health: entry.health,
        capabilities: entry.provider.getCapabilities(model),
      };
    });

    // Sort by cost (cheapest first) when preferCheaper is enabled
    const sorted = this.preferCheaper
      ? [...estimates].sort((a, b) => a.estimatedCost - b.estimatedCost)
      : estimates;

    // Pick the cheapest that meets minimum quality requirements
    const selected = sorted[0] ?? estimates[0];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const cheapestCost = Math.min(...estimates.map((e) => e.estimatedCost));

    const usedCheaperAlternative =
      selected.id !== routeDecision.provider ||
      selected.estimatedCost < (estimates.find((e) => e.id === routeDecision.provider)?.estimatedCost ?? Infinity);

    const exceedsTierLimit = selected.estimatedCost > TIER_COST_LIMITS[this.userTier];

    const reason = usedCheaperAlternative
      ? `cheaper_alternative:${selected.id} ($${selected.estimatedCost.toFixed(6)} vs $${estimates.find((e) => e.id === routeDecision.provider)?.estimatedCost.toFixed(6) ?? 'N/A'})`
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
   * Find a cheaper provider within a cost budget.
   */
  private findCheaperProvider(
    chain: Array<{
      id: ProviderId;
      provider: {
        estimateCost: (messages: ChatMessage[], model: string, options?: ChatOptions) => number;
      };
      health: { avgLatencyMs: number };
    }>,
    messages: ChatMessage[],
    options: ChatOptions,
    budget: number,
  ): { id: ProviderId; model: string; estimatedCost: number } | null {
    for (const entry of chain) {
      const model = this.getDefaultModel(entry.id, classifyComplexity(''));
      const cost = entry.provider.estimateCost(messages, model, options);

      if (cost <= budget) {
        return { id: entry.id, model, estimatedCost: cost };
      }
    }

    return null;
  }

  /**
   * Get the default model for a provider given a complexity level.
   */
  private getDefaultModel(providerId: ProviderId, complexity: Complexity): string {
    const route = selectRoute(complexity);
    if (route.provider === providerId) return route.model;

    // Fallback models per provider
    const fallbackModels: Record<ProviderId, string> = {
      openrouter: 'openai/gpt-4o-mini',
      anthropic: 'claude-haiku-3-5',
      elevenlabs: 'elevenlabs/eleven_turbo_v2_5',
      wan: 'wan/wan-2-1-t2v',
      'fish-speech': 'fish-speech/fish-speech-1-5',
    };

    return fallbackModels[providerId] ?? 'openai/gpt-4o-mini';
  }
}

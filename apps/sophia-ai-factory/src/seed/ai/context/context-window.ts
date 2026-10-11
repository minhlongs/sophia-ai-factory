import type { ChatMessage } from '../provider-interface';
import type { ContextWindowConfig, ContextUtilizationReport } from './types';
import { DEFAULT_MODEL_LIMITS } from './defaults';
import { estimateTextTokens, estimateMessageTokens } from './token-estimator';
import { logger } from '@/seed/utils/logger-utility';

/**
 * Manages context window tracking for AI model conversations.
 *
 * Provides context limit lookup, remaining budget calculation,
 * and consolidation triggers to prevent context window overflow.
 */
export class ContextWindow {
  private readonly modelLimits: Map<string, ContextWindowConfig>;

  constructor(customLimits?: Record<string, ContextWindowConfig>) {
    this.modelLimits = new Map(
      Object.entries({ ...DEFAULT_MODEL_LIMITS, ...(customLimits ?? {}) }),
    );
    logger.info('[ContextWindow] Initialized', undefined, {
      knownModels: Array.from(this.modelLimits.keys()),
    });
  }

  getLimit(model: string): ContextWindowConfig {
    const existing = this.modelLimits.get(model);
    if (existing) return existing;

    // Try matching by prefix (e.g. `openai/gpt-4o-mini` → `gpt-4o-mini`).
    const stripped = model.includes('/') ? model.split('/').pop()! : model;
    const prefixMatch = this.modelLimits.get(stripped);
    if (prefixMatch) return prefixMatch;

    // Conservative fallback for unknown models.
    logger.warn('[ContextWindow] Unknown model, using fallback limit', undefined, {
      model,
    });
    return {
      modelId: model,
      contextLimit: 128_000,
      consolidationThreshold: 0.75,
    };
  }

  registerModel(config: ContextWindowConfig): void {
    this.modelLimits.set(config.modelId, config);
    logger.info('[ContextWindow] Registered model limit', undefined, {
      modelId: config.modelId,
      contextLimit: config.contextLimit,
    });
  }

  getRemaining(messages: ChatMessage[], systemPrompt: string, model: string): number {
    const limit = this.getLimit(model);
    const messageTokens = estimateMessageTokens(messages);
    const systemTokens = estimateTextTokens(systemPrompt);
    const totalUsed = messageTokens + systemTokens;
    // Reserve 5% as safety margin.
    const safeLimit = Math.floor(limit.contextLimit * 0.95);
    const remaining = Math.max(0, safeLimit - totalUsed);

    logger.debug('[ContextWindow] Remaining budget', undefined, {
      model: limit.modelId,
      contextLimit: limit.contextLimit,
      messageTokens,
      systemTokens,
      totalUsed,
      remaining,
    });

    return remaining;
  }

  getUtilizationReport(
    messages: ChatMessage[],
    systemPrompt: string,
    model: string,
  ): ContextUtilizationReport {
    const limit = this.getLimit(model);
    const messageTokens = estimateMessageTokens(messages);
    const systemTokens = estimateTextTokens(systemPrompt);
    const usedTokens = messageTokens + systemTokens;
    const ratio = usedTokens / limit.contextLimit;

    return {
      modelId: limit.modelId,
      contextLimit: limit.contextLimit,
      usedTokens,
      systemTokens,
      messageTokens,
      utilizationRatio: ratio,
      utilizationPercent: Math.round(ratio * 100),
      remainingTokens: Math.max(0, limit.contextLimit - usedTokens),
      needsConsolidation: ratio >= limit.consolidationThreshold,
    };
  }

  needsConsolidation(messages: ChatMessage[], systemPrompt: string, model: string): boolean {
    const limit = this.getLimit(model);
    const messageTokens = estimateMessageTokens(messages);
    const systemTokens = estimateTextTokens(systemPrompt);
    const ratio = (messageTokens + systemTokens) / limit.contextLimit;
    const needs = ratio >= limit.consolidationThreshold;

    if (needs) {
      logger.warn('[ContextWindow] Consolidation needed', undefined, {
        model: limit.modelId,
        utilizationPercent: Math.round(ratio * 100),
        threshold: Math.round(limit.consolidationThreshold * 100),
        usedTokens: messageTokens + systemTokens,
        contextLimit: limit.contextLimit,
      });
    }

    return needs;
  }
}

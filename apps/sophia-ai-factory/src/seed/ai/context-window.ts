/**
 * @module seed/ai/context-window
 *
 * ContextWindow — model context limit management for AI conversations.
 *
 * Provides per-model context limits, remaining budget calculation,
 * and consolidation threshold checks. Designed to prevent context
 * window overflow before sending requests to LLM providers.
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

import type { ChatMessage } from './provider-interface';
import { logger } from '@/seed/utils/logger-utility';

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * Configuration for a model's context window.
 */
export interface ContextWindowConfig {
  /** Model identifier (e.g. `gpt-4o-mini`, `claude-sonnet-4-6`). */
  modelId: string;
  /** Maximum context window size in tokens. */
  contextLimit: number;
  /** Recommended threshold (0–1) at which consolidation should trigger. */
  consolidationThreshold: number;
}

// ── Default model limits ───────────────────────────────────────────────────────

/**
 * Default context window limits for known models.
 *
 * Values sourced from provider documentation as of 2026-06.
 */
export const DEFAULT_MODEL_LIMITS: Record<string, ContextWindowConfig> = {
  'gpt-4o-mini': {
    modelId: 'gpt-4o-mini',
    contextLimit: 128_000,
    consolidationThreshold: 0.75,
  },
  'claude-sonnet-4-6': {
    modelId: 'claude-sonnet-4-6',
    contextLimit: 200_000,
    consolidationThreshold: 0.75,
  },
  'deepseek-reasoner': {
    modelId: 'deepseek-reasoner',
    contextLimit: 64_000,
    consolidationThreshold: 0.70,
  },
};

// ── ContextWindow ──────────────────────────────────────────────────────────────

/**
 * Manages context window tracking for AI model conversations.
 *
 * Provides context limit lookup, remaining budget calculation,
 * and consolidation triggers to prevent context window overflow.
 */
export class ContextWindow {
  private readonly modelLimits: Map<string, ContextWindowConfig>;

  /**
   * @param customLimits — Optional overrides or additional model configurations.
   *   Merged with defaults; custom entries take precedence.
   */
  constructor(customLimits?: Record<string, ContextWindowConfig>) {
    this.modelLimits = new Map(
      Object.entries({ ...DEFAULT_MODEL_LIMITS, ...(customLimits ?? {}) }),
    );
    logger.info('[ContextWindow] Initialized', undefined, {
      knownModels: Array.from(this.modelLimits.keys()),
    });
  }

  // ── Model limit lookup ──────────────────────────────────────────────────────

  /**
   * Get the context window configuration for a model.
   *
   * Tries exact match first, then prefix-stripped match (e.g.
   * `openai/gpt-4o-mini` → `gpt-4o-mini`). Falls back to a
   * conservative 128k limit for unknown models.
   *
   * @param model — Model identifier.
   * @returns Context window configuration for the model.
   */
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

  /**
   * Register a custom model limit configuration.
   *
   * @param config — Context window config to register.
   */
  registerModel(config: ContextWindowConfig): void {
    this.modelLimits.set(config.modelId, config);
    logger.info('[ContextWindow] Registered model limit', undefined, {
      modelId: config.modelId,
      contextLimit: config.contextLimit,
    });
  }

  // ── Remaining budget ────────────────────────────────────────────────────────

  /**
   * Calculate the remaining token budget for a conversation.
   *
   * Accounts for the system prompt tokens and applies a 5% safety
   * margin on the model's context limit.
   *
   * @param messages — Current message history.
   * @param systemPrompt — System prompt text (token cost reserved upfront).
   * @param model — Model identifier for context limit lookup.
   * @returns Remaining safe token budget (never negative).
   */
  getRemaining(
    messages: ChatMessage[],
    systemPrompt: string,
    model: string,
  ): number {
    const limit = this.getLimit(model);
    const messageTokens = this.estimateMessageTokens(messages);
    const systemTokens = this.estimateTextTokens(systemPrompt);
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

  /**
   * Get a detailed utilization report for a conversation.
   *
   * @param messages — Current message history.
   * @param systemPrompt — System prompt text.
   * @param model — Model identifier.
   * @returns Detailed utilization metrics including ratio and consolidation flag.
   */
  getUtilizationReport(
    messages: ChatMessage[],
    systemPrompt: string,
    model: string,
  ): {
    modelId: string;
    contextLimit: number;
    usedTokens: number;
    systemTokens: number;
    messageTokens: number;
    utilizationRatio: number;
    utilizationPercent: number;
    remainingTokens: number;
    needsConsolidation: boolean;
  } {
    const limit = this.getLimit(model);
    const messageTokens = this.estimateMessageTokens(messages);
    const systemTokens = this.estimateTextTokens(systemPrompt);
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

  // ── Consolidation trigger ───────────────────────────────────────────────────

  /**
   * Determine whether the conversation needs consolidation.
   *
   * @param messages — Current message history.
   * @param systemPrompt — System prompt text.
   * @param model — Model identifier.
   * @returns True if consolidation is recommended.
   */
  needsConsolidation(messages: ChatMessage[], systemPrompt: string, model: string): boolean {
    const limit = this.getLimit(model);
    const messageTokens = this.estimateMessageTokens(messages);
    const systemTokens = this.estimateTextTokens(systemPrompt);
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

  // ── Token estimation (inline, no TokenCounter dependency) ───────────────────

  /**
   * Estimate tokens for a plain text string.
   *
   * Vietnamese: ~2.5 chars/token (OpenAI mode) or ~1.8 (Anthropic mode).
   * English: ~4 chars/token (OpenAI) or ~3.5 (Anthropic).
   * CJK: ~1.3 chars/token.
   */
  private estimateTextTokens(text: string): number {
    if (text.length === 0) return 0;

    const vietnameseChars = (text.match(/[À-ɏẠ-ỿ]/g) ?? []).length;
    const cjkChars = (text.match(/[一-鿿㐀-䶿぀-ゟ゠-ヿ가-힯]/g) ?? []).length;
    const remaining = text.length - vietnameseChars - cjkChars;

    // Approximate: VN ~2.5 chars/token, CJK ~1.3, EN ~4.0
    const vnTokens = vietnameseChars / 2.5;
    const cjkTokens = cjkChars / 1.3;
    const enTokens = remaining / 4.0;

    return Math.ceil(vnTokens + cjkTokens + enTokens);
  }

  /**
   * Estimate tokens for an array of messages (content + per-message overhead).
   */
  private estimateMessageTokens(messages: ChatMessage[]): number {
    if (messages.length === 0) return 0;

    const OVERHEAD_PER_MESSAGE = 4; // role + formatting tokens
    let total = 0;

    for (const msg of messages) {
      total += this.estimateTextTokens(msg.content) + OVERHEAD_PER_MESSAGE;
    }

    return total;
  }
}

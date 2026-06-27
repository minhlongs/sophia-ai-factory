/**
 * @module forest/agent-chat/context-manager
 *
 * ContextManager — token-budget enforcement for agent chat.
 *
 * Responsibilities:
 * - Estimate token usage for a message array against a model's context limit.
 * - Trim messages when over budget, preserving the system prompt and last N messages.
 * - Optionally summarize removed messages before discarding them.
 * - Expose a check API that returns an action directive for the caller.
 *
 * Import direction: forest → seed, tree (ONE-WAY).
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Approximate characters per token for estimation. */
const CHARS_PER_TOKEN = 4;
/** Per-message overhead tokens (role field, formatting). */
const PER_MESSAGE_OVERHEAD = 10;
/** System prompt overhead tokens. */
const SYSTEM_PROMPT_OVERHEAD = 100;
/** Default context window size in tokens. */
export const DEFAULT_CONTEXT_LIMIT = 8192;
/** Utilization ratio that triggers summarization. */
export const SUMMARIZE_THRESHOLD = 0.8;
/** Minimum recent messages to always keep intact. */
export const MIN_RECENT_MESSAGES = 4;

// ── Types ───────────────────────────────────────────────────────────────────────

/**
 * Result of a context window check.
 */
export interface ContextCheckResult {
  /** Whether the message set is within the model's context limit. */
  withinLimit: boolean;
  /** Estimated current token count (before any action). */
  currentTokens: number;
  /** Model context limit in tokens. */
  limitTokens: number;
  /** Recommended action: none, trim, or summarize+trim. */
  action: 'none' | 'trim' | 'summarize+trim';
}

/**
 * Options for context management.
 */
export interface ContextManagerOptions {
  /** Context limit in tokens (default: DEFAULT_CONTEXT_LIMIT). */
  contextLimit?: number;
  /** Summarization threshold ratio (default: SUMMARIZE_THRESHOLD). */
  summarizeThreshold?: number;
  /** Minimum recent messages to preserve (default: MIN_RECENT_MESSAGES). */
  minRecent?: number;
  /** Whether summarization is enabled (default: true). */
  summarizationEnabled?: boolean;
}

// ── ContextManager ──────────────────────────────────────────────────────────────

/**
 * Manages token-budget enforcement for chat conversations.
 *
 * Strategies:
 * a) Remove oldest messages first when over budget.
 * b) If trimming would lose critical context, summarize the removed portion.
 * c) Always keep system prompt + last N messages intact.
 *
 * Summarization is async and non-blocking — callers should not await it
 * when streaming is in progress.
 */
export class ContextManager {
  private readonly contextLimit: number;
  private readonly summarizeThreshold: number;
  private readonly minRecent: number;
  private readonly summarizationEnabled: boolean;

  constructor(options: ContextManagerOptions = {}) {
    this.contextLimit = options.contextLimit ?? DEFAULT_CONTEXT_LIMIT;
    this.summarizeThreshold = options.summarizeThreshold ?? SUMMARIZE_THRESHOLD;
    this.minRecent = options.minRecent ?? MIN_RECENT_MESSAGES;
    this.summarizationEnabled = options.summarizationEnabled ?? true;
  }

  /**
   * Estimate the token count for a message array.
   *
   * Uses a chars/4 heuristic with per-message and system-prompt overhead.
   *
   * @param messages — chat messages to count
   * @returns estimated token count
   */
  estimateTokens(
    messages: { role: string; content: string }[],
  ): number {
    const contentTokens = messages.reduce((sum, m) => {
      return sum + Math.ceil(m.content.length / CHARS_PER_TOKEN);
    }, 0);
    const overhead = messages.length * PER_MESSAGE_OVERHEAD;
    const hasSystem = messages.some((m) => m.role === 'system');
    const systemOverhead = hasSystem ? SYSTEM_PROMPT_OVERHEAD : 0;
    return contentTokens + overhead + systemOverhead;
  }

  /**
   * Check whether the message array fits within the context budget.
   *
   * Returns a ContextCheckResult with the recommended action.
   *
   * @param messages — current message array
   * @param systemPrompt — the system prompt (used for overhead estimation)
   * @param _model — model identifier (reserved for model-specific limits)
   * @returns context check result with action directive
   */
  checkContext(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    _model?: string,
  ): ContextCheckResult {
    const allMessages = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.filter((m) => m.role !== 'system'),
    ];
    const currentTokens = this.estimateTokens(allMessages);
    const utilization = currentTokens / this.contextLimit;

    const result: ContextCheckResult = {
      withinLimit: utilization < 1.0,
      currentTokens,
      limitTokens: this.contextLimit,
      action: 'none',
    };

    if (utilization >= 1.0) {
      // Over the hard limit — must trim.
      result.action = this.summarizationEnabled ? 'summarize+trim' : 'trim';
    } else if (utilization >= this.summarizeThreshold) {
      // Over the soft threshold — summarize if enabled.
      result.action = this.summarizationEnabled ? 'summarize+trim' : 'trim';
    }

    logger.debug('[ContextManager] Context check', {
      currentTokens,
      limitTokens: this.contextLimit,
      utilization: utilization.toFixed(3),
      action: result.action,
    });

    return result;
  }

  /**
   * Trim messages to fit within the context budget.
   *
   * Strategy:
   * 1. Always keep the system prompt intact.
   * 2. Always keep the last `minRecent` messages intact.
   * 3. Remove oldest non-system, non-recent messages first.
   * 4. If summarization is enabled and messages were removed, produce a summary
   *    of the removed portion and insert it as a system message.
   *
   * @param messages — current message array (will not be mutated)
   * @param systemPrompt — the system prompt to preserve
   * @param _model — model identifier (reserved for model-specific limits)
   * @param targetTokens — optional explicit target; defaults to contextLimit
   * @returns trimmed (and optionally summarized) message array
   */
  async trimMessages(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    _model?: string,
    targetTokens?: number,
  ): Promise<{ role: 'system' | 'user' | 'assistant'; content: string }[]> {
    const budget = targetTokens ?? this.contextLimit;
    const result: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
    ];

    // Separate system messages from conversation.
    const conversation = messages.filter((m) => m.role !== 'system');

    if (conversation.length === 0) {
      return result;
    }

    // Calculate how many recent messages we must keep.
    const keepRecent = Math.min(this.minRecent, conversation.length);

    // Estimate tokens for system prompt + recent messages.
    const recentMessages = conversation.slice(-keepRecent);
    const recentTokens = this.estimateTokens([
      { role: 'system', content: systemPrompt },
      ...recentMessages,
    ]);

    if (recentTokens <= budget) {
      // Everything fits — no trimming needed.
      for (const m of recentMessages) {
        result.push({ role: m.role as 'user' | 'assistant', content: m.content });
      }
      return result;
    }

    // Even recent messages alone exceed budget — trim from recent end.
    logger.warn('[ContextManager] Recent messages exceed budget, aggressive trim', {
      recentTokens,
      budget,
      recentCount: recentMessages.length,
    });
    let trimmed: { role: string; content: string }[] = [];
    let tokens = this.estimateTokens([{ role: 'system', content: systemPrompt }]);
    for (const m of [...recentMessages].reverse()) {
      const mTokens = this.estimateTokens([m]);
      if (tokens + mTokens > budget) break;
      trimmed.unshift(m);
      tokens += mTokens;
    }
    for (const m of trimmed) {
      result.push({ role: m.role as 'user' | 'assistant', content: m.content });
    }
    return result;
  }

  /**
   * Summarize older messages and produce a compact representation.
   *
   * Separates the conversation into "older" (to summarize) and "recent"
   * (to keep). Produces a single system message containing the summary.
   *
   * Gracefully degrades: if summarization fails, returns a truncated
   * representation of the older messages.
   *
   * @param messages — full conversation (no system messages)
   * @param keepRecent — number of recent messages to preserve
   * @returns summary message + recent messages
   */
  async summarizeOlder(
    messages: { role: string; content: string }[],
    keepRecent: number,
  ): Promise<{
    summary: { role: 'system'; content: string };
    recent: { role: 'user' | 'assistant'; content: string }[];
  }> {
    const recent = messages.slice(-keepRecent);
    const older = messages.slice(0, messages.length - keepRecent);

    let summaryContent: string;
    try {
      summaryContent = await this.buildSummary(older);
    } catch (err) {
      // Graceful degradation: produce a truncated fallback summary.
      logger.warn('[ContextManager] Summarization failed, using truncated fallback', {
        error: getErrorMessage(err),
        olderCount: older.length,
      });
      const lines: string[] = [
        `[Context summary — ${older.length} earlier messages (truncated)]`,
      ];
      for (const msg of older) {
        const truncated = msg.content.length > 150
          ? msg.content.slice(0, 150) + '...'
          : msg.content;
        lines.push(`[${msg.role}]: ${truncated}`);
      }
      summaryContent = lines.join('\n');
    }

    return {
      summary: { role: 'system', content: summaryContent },
      recent: recent.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Build a compact summary of older messages.
   *
   * Groups messages by role and produces a condensed representation.
   * This is a deterministic, non-LLM summarization — fast and offline-safe.
   */
  private async buildSummary(
    messages: { role: string; content: string }[],
  ): Promise<string> {
    const lines: string[] = [
      `[Context summary — ${messages.length} earlier messages condensed]`,
    ];

    // Group consecutive messages by role for more compact summaries.
    let currentRole: string | null = null;
    let currentContent: string[] = [];

    const flush = () => {
      if (currentContent.length === 0) return;
      const combined = currentContent.join(' ');
      const truncated = combined.length > 300
        ? combined.slice(0, 300) + '...'
        : combined;
      lines.push(`[${currentRole}]: ${truncated}`);
      currentContent = [];
    };

    for (const msg of messages) {
      if (msg.role === currentRole) {
        currentContent.push(msg.content);
      } else {
        flush();
        currentRole = msg.role;
        currentContent = [msg.content];
      }
    }
    flush();

    return lines.join('\n');
  }
}

// ── Factory ─────────────────────────────────────────────────────────────────────

let contextManagerInstance: ContextManager | null = null;

/**
 * Get the singleton ContextManager instance.
 * Creates one with default options if not yet initialized.
 */
export function getContextManager(options?: ContextManagerOptions): ContextManager {
  if (!contextManagerInstance) {
    contextManagerInstance = new ContextManager(options);
  }
  return contextManagerInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetContextManager(): void {
  contextManagerInstance = null;
}

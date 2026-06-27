/**
 * @module forest/memory/context-window-service
 *
 * ContextWindowService — orchestrates context window management for agent chat.
 *
 * Responsibilities:
 * - Check token utilization against model context limits
 * - Trigger summarization when utilization exceeds threshold
 * - Manage message trimming (keep last N + summary)
 *
 * Used by the API route before sending to LLM.
 * Gracefully degrades: if any step fails, proceeds without summarization.
 *
 * Import direction: forest → seed, tree (ONE-WAY)
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { MemoryConsolidator } from '@/tree/memory/memory-consolidator';

// ── Constants ──────────────────────────────────────────────────────────────────

/** Default context window size (tokens) for typical LLMs. */
export const DEFAULT_CONTEXT_LIMIT = 8192;
/** Utilization threshold (0.0–1.0) that triggers summarization. */
export const CONTEXT_SUMMARIZE_THRESHOLD = 0.8;
/** Number of recent messages to keep after summarization. */
export const KEEP_RECENT_MESSAGES = 6;
/** Approximate chars-per-token ratio for estimation. */
export const CHARS_PER_TOKEN = 4;

// ── Types ──────────────────────────────────────────────────────────────────────

/** Result of a context window check. */
export interface ContextCheckResult {
  /** Whether summarization was triggered. */
  summarized: boolean;
  /** Original message count before trimming. */
  originalCount: number;
  /** Message count after trimming. */
  trimmedCount: number;
  /** Estimated token usage before. */
  estimatedTokensBefore: number;
  /** Estimated token usage after. */
  estimatedTokensAfter: number;
  /** Context limit used for the check. */
  contextLimit: number;
  /** Utilization ratio before trimming (0.0–1.0). */
  utilizationBefore: number;
}

/** Options for context window management. */
export interface ContextWindowOptions {
  /** Context limit in tokens (default: DEFAULT_CONTEXT_LIMIT). */
  contextLimit?: number;
  /** Summarization threshold ratio (default: CONTEXT_SUMMARIZE_THRESHOLD). */
  summarizeThreshold?: number;
  /** Number of recent messages to preserve (default: KEEP_RECENT_MESSAGES). */
  keepRecent?: number;
  /** User ID for memory consolidation after summarization. */
  userId?: string;
}

// ── ContextWindowService ───────────────────────────────────────────────────────

/**
 * Orchestrates context window management for chat sessions.
 *
 * Checks token utilization, triggers summarization when over threshold,
 * and manages message trimming. Gracefully degrades on failure.
 */
export class ContextWindowService {
  private readonly options: Required<ContextWindowOptions>;

  constructor(options: ContextWindowOptions = {}) {
    this.options = {
      contextLimit: options.contextLimit ?? DEFAULT_CONTEXT_LIMIT,
      summarizeThreshold: options.summarizeThreshold ?? CONTEXT_SUMMARIZE_THRESHOLD,
      keepRecent: options.keepRecent ?? KEEP_RECENT_MESSAGES,
      userId: options.userId ?? 'anonymous',
    };
  }

  /**
   * Estimate token count for a message array.
   *
   * Uses a simple chars/4 heuristic — fast and conservative.
   * Includes system prompt overhead (~100 tokens).
   *
   * @param messages — chat messages to count
   * @returns estimated token count
   */
  estimateTokens(messages: { role: string; content: string }[]): number {
    const contentTokens = messages.reduce((sum, m) => {
      return sum + Math.ceil(m.content.length / CHARS_PER_TOKEN);
    }, 0);
    // Add per-message overhead (role, formatting ~10 tokens each).
    const overhead = messages.length * 10;
    // System prompt overhead if present.
    const hasSystem = messages.some((m) => m.role === 'system');
    const systemOverhead = hasSystem ? 100 : 0;
    return contentTokens + overhead + systemOverhead;
  }

  /**
   * Check if context window is over the summarization threshold.
   *
   * @param messages — current message array
   * @returns true if utilization exceeds threshold
   */
  isOverThreshold(
    messages: { role: string; content: string }[],
  ): boolean {
    const tokens = this.estimateTokens(messages);
    const utilization = tokens / this.options.contextLimit;
    return utilization >= this.options.summarizeThreshold;
  }

  /**
   * Manage the context window for a chat session.
   *
   * If utilization exceeds the threshold, summarizes oldest messages
   * and keeps only the most recent N messages plus the summary.
   *
   * Gracefully degrades: if summarization fails, returns original messages.
   *
   * @param messages — current message array (will not be mutated)
   * @returns context check result with trimmed messages info
   */
  async manageContext(
    messages: { role: string; content: string }[],
  ): Promise<ContextCheckResult> {
    const tokensBefore = this.estimateTokens(messages);
    const utilizationBefore = tokensBefore / this.options.contextLimit;

    const result: ContextCheckResult = {
      summarized: false,
      originalCount: messages.length,
      trimmedCount: messages.length,
      estimatedTokensBefore: tokensBefore,
      estimatedTokensAfter: tokensBefore,
      contextLimit: this.options.contextLimit,
      utilizationBefore,
    };

    // Skip if under threshold.
    if (!this.isOverThreshold(messages)) {
      logger.debug('[ContextWindow] Under threshold, no summarization needed', {
        userId: this.options.userId,
        tokens: tokensBefore,
        limit: this.options.contextLimit,
        utilization: utilizationBefore.toFixed(2),
      });
      return result;
    }

    logger.info('[ContextWindow] Over threshold, triggering summarization', {
      userId: this.options.userId,
      tokens: tokensBefore,
      limit: this.options.contextLimit,
      utilization: utilizationBefore.toFixed(2),
      messageCount: messages.length,
    });

    try {
      const trimmed = await this.summarizeOldest(messages);
      const tokensAfter = this.estimateTokens(trimmed);

      result.summarized = true;
      result.trimmedCount = trimmed.length;
      result.estimatedTokensAfter = tokensAfter;

      logger.info('[ContextWindow] Summarization complete', {
        userId: this.options.userId,
        originalCount: result.originalCount,
        trimmedCount: result.trimmedCount,
        tokensBefore,
        tokensAfter,
        savedTokens: tokensBefore - tokensAfter,
      });

      // Trigger async memory consolidation for the user.
      this.consolidateMemoriesAsync(this.options.userId);

      return result;
    } catch (err) {
      // Graceful degradation: proceed with original messages.
      logger.warn('[ContextWindow] Summarization failed, proceeding without', {
        userId: this.options.userId,
        error: getErrorMessage(err),
      });
      return result;
    }
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /**
   * Summarize the oldest messages, keeping the most recent N.
   *
   * Replaces older messages with a single summary system message.
   * Does NOT mutate the input array.
   */
  private async summarizeOldest(
    messages: { role: string; content: string }[],
  ): Promise<{ role: string; content: string }[]> {
    const keepRecent = this.options.keepRecent;
    const total = messages.length;

    if (total <= keepRecent + 1) {
      // Not enough messages to summarize meaningfully.
      return messages;
    }

    // Separate system message (if any) from conversation.
    const systemMsg = messages.find((m) => m.role === 'system');
    const conversation = messages.filter((m) => m.role !== 'system');

    // Keep the most recent N conversation messages.
    const recent = conversation.slice(-keepRecent);
    // Summarize the older messages.
    const older = conversation.slice(0, conversation.length - keepRecent);

    if (older.length === 0) {
      return messages;
    }

    // Build a compact summary of older messages.
    const summaryLines: string[] = [];
    for (const msg of older) {
      const truncated = msg.content.length > 200
        ? msg.content.slice(0, 200) + '...'
        : msg.content;
      summaryLines.push(`[${msg.role}]: ${truncated}`);
    }

    const summaryContent = [
      `[Context summary — ${older.length} earlier messages condensed]`,
      ...summaryLines,
    ].join('\n');

    // Reconstruct: system (if any) + summary + recent messages.
    const result: { role: string; content: string }[] = [];
    if (systemMsg) {
      result.push(systemMsg);
    }
    result.push({ role: 'system', content: summaryContent });
    result.push(...recent);

    return result;
  }

  /**
   * Trigger memory consolidation asynchronously (fire-and-forget).
   */
  private consolidateMemoriesAsync(userId: string): void {
    try {
      const consolidator = new MemoryConsolidator();
      // Fire-and-forget: do not await.
      consolidator.consolidate(userId).catch((err) => {
        logger.warn('[ContextWindow] Async consolidation failed', {
          userId,
          error: getErrorMessage(err),
        });
      });
    } catch {
      // Silently ignore — consolidation is non-critical.
    }
  }
}

// ── Factory ────────────────────────────────────────────────────────────────────

let contextWindowServiceInstance: ContextWindowService | null = null;

/**
 * Get the singleton ContextWindowService instance.
 * Creates one with default options if not yet initialized.
 */
export function getContextWindowService(
  options?: ContextWindowOptions,
): ContextWindowService {
  if (!contextWindowServiceInstance) {
    contextWindowServiceInstance = new ContextWindowService(options);
  }
  return contextWindowServiceInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetContextWindowService(): void {
  contextWindowServiceInstance = null;
}

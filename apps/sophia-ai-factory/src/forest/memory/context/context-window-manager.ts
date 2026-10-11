import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { MemoryConsolidator } from '@/tree/memory/memory-consolidator';
import {
  CHARS_PER_TOKEN,
  DEFAULT_CONTEXT_LIMIT,
  CONTEXT_SUMMARIZE_THRESHOLD,
  KEEP_RECENT_MESSAGES,
  ContextCheckResult,
  ContextWindowOptions,
} from './constants-and-types';

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

  /**
   * Summarize the oldest messages, keeping the most recent N.
   */
  private async summarizeOldest(
    messages: { role: string; content: string }[],
  ): Promise<{ role: string; content: string }[]> {
    const keepRecent = this.options.keepRecent;
    const total = messages.length;

    if (total <= keepRecent + 1) {
      return messages;
    }

    const systemMsg = messages.find((m) => m.role === 'system');
    const conversation = messages.filter((m) => m.role !== 'system');

    const recent = conversation.slice(-keepRecent);
    const older = conversation.slice(0, conversation.length - keepRecent);

    if (older.length === 0) {
      return messages;
    }

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

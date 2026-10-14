import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  CHARS_PER_TOKEN,
  DEFAULT_CONTEXT_LIMIT,
  CONTEXT_SUMMARIZE_THRESHOLD,
  KEEP_RECENT_MESSAGES,
  ContextCheckResult,
  ContextWindowOptions,
} from './constants-and-types';
import {
  summarizeOldestMessages,
  triggerAsyncMemoryConsolidation,
} from './context-summarizer-helpers';

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

  estimateTokens(messages: { role: string; content: string }[]): number {
    const contentTokens = messages.reduce((sum, m) => {
      return sum + Math.ceil(m.content.length / CHARS_PER_TOKEN);
    }, 0);
    const overhead = messages.length * 10;
    const hasSystem = messages.some((m) => m.role === 'system');
    const systemOverhead = hasSystem ? 100 : 0;
    return contentTokens + overhead + systemOverhead;
  }

  isOverThreshold(messages: { role: string; content: string }[]): boolean {
    const tokens = this.estimateTokens(messages);
    const utilization = tokens / this.options.contextLimit;
    return utilization >= this.options.summarizeThreshold;
  }

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
      const trimmed = summarizeOldestMessages(messages, this.options.keepRecent);
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

      triggerAsyncMemoryConsolidation(this.options.userId);
      return result;
    } catch (err) {
      logger.warn('[ContextWindow] Summarization failed, proceeding without', {
        userId: this.options.userId,
        error: getErrorMessage(err),
      });
      return result;
    }
  }
}

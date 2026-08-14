/**
 * @module forest/agent-chat/memory-consolidation-service
 *
 * MemoryConsolidationService — orchestrates conversation memory consolidation.
 *
 * Responsibilities:
 * - Check conversation context size against model limits.
 * - Trim and/or summarize messages when over budget.
 * - Store conversation summaries to memory_kv via the memory adapter.
 * - Prune stale conversation memories periodically.
 *
 * Import direction: forest → seed, tree (ONE-WAY).
 * Calls land/openclaw memory-adapter for storage (orchestration boundary).
 */

import { logger } from '@/seed/utils/logger-utility';
import { getContextManager } from './context-manager';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { ConsolidationResult } from './memory-consolidation-types';
import {
  storeSummaryAsync,
  pruneOldMemories,
  getConversationMemory,
  listConversationMemories,
} from './memory-consolidation-storage';

// ── Re-export sub-modules for convenience ─────────────────────────────────────

export type { ConversationMemory, ConsolidationResult } from './memory-consolidation-types';

// ── MemoryConsolidationService ────────────────────────────────────────────────

/**
 * Orchestrates conversation memory consolidation for agent chat.
 *
 * Flow:
 * a) Check context size against model limit.
 * b) Trim/summarize if over budget.
 * c) Store summary to memory_kv via the memory adapter.
 * d) Prune old memories periodically.
 *
 * Summarization is async and non-blocking — callers should not await it
 * when streaming is in progress.
 */
export class MemoryConsolidationService {
  private readonly contextManager: ReturnType<typeof getContextManager>;

  constructor() {
    this.contextManager = getContextManager();
  }

  /**
   * Consolidate a conversation: check size, trim/summarize if needed,
   * store summary, and prune old memories.
   *
   * @param conversationId — unique conversation identifier
   * @param messages — full message array (user + assistant + optional system)
   * @param userId — user identifier for memory scoping
   * @returns consolidation result
   */
  async consolidate(
    conversationId: string,
    messages: { role: string; content: string }[],
    userId: string,
  ): Promise<ConsolidationResult> {
    logger.info('[MemoryConsolidation] Starting consolidation', {
      conversationId,
      userId,
      messageCount: messages.length,
    });

    try {
      // Step a: Check context size.
      const systemPrompt = messages.find((m) => m.role === 'system')?.content ?? 'You are a helpful AI assistant.';
      const chatMessages = messages.filter((m) => m.role !== 'system');
      const contextResult = this.contextManager.checkContext(
        chatMessages,
        systemPrompt,
      );

      let trimmedMessages = [...messages];
      let summaryContent: string | null = null;

      // Step b: Trim and/or summarize if over budget.
      if (contextResult.action === 'trim') {
        trimmedMessages = await this.contextManager.trimMessages(
          chatMessages,
          systemPrompt,
        );
      } else if (contextResult.action === 'summarize+trim') {
        const { summary, recent } = await this.contextManager.summarizeOlder(
          chatMessages,
          4, // minRecent messages to keep
        );

        if (summary) {
          summaryContent = summary.content;
          trimmedMessages = [
            { role: 'system', content: systemPrompt },
            summary,
            ...recent,
          ];
        } else {
          // Fallback to trimming if summarization failed.
          trimmedMessages = await this.contextManager.trimMessages(
            chatMessages,
            systemPrompt,
          );
        }
      }

      const tokensAfter = this.contextManager.estimateTokens(trimmedMessages);

      // Step c: Store summary to memory_kv (non-blocking fire-and-forget).
      let summaryStored = false;
      if (summaryContent) {
        storeSummaryAsync(
          conversationId,
          summaryContent,
          messages.length,
          userId,
        ).then((stored) => {
          summaryStored = stored;
        }).catch(() => {
          // Non-critical: summary storage failure does not affect the response.
        });
      }

      logger.info('[MemoryConsolidation] Consolidation complete', {
        conversationId,
        userId,
        action: contextResult.action,
        tokensBefore: contextResult.currentTokens,
        tokensAfter,
        savedTokens: contextResult.currentTokens - tokensAfter,
        messageCount: messages.length,
        trimmedCount: trimmedMessages.length,
      });

      // Step d: Prune old memories (fire-and-forget).
      pruneOldMemoriesAsync(userId);

      return {
        success: true,
        conversationId,
        action: contextResult.action,
        tokensBefore: contextResult.currentTokens,
        tokensAfter,
        summaryStored,
      };
    } catch (err) {
      const errorMsg = getErrorMessage(err);
      logger.error('[MemoryConsolidation] Consolidation failed', {
        conversationId,
        userId,
        error: errorMsg,
      });
      return {
        success: false,
        conversationId,
        action: 'none',
        tokensBefore: 0,
        tokensAfter: 0,
        summaryStored: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Fire-and-forget consolidation — calls consolidate() but does not
   * return a promise to the caller. Errors are logged internally.
   *
   * @param conversationId — unique conversation identifier
   * @param messages — full message array
   * @param userId — user identifier
   */
  consolidateFireAndForget(
    conversationId: string,
    messages: { role: string; content: string }[],
    userId: string,
  ): void {
    this.consolidate(conversationId, messages, userId).catch((err) => {
      logger.warn('[MemoryConsolidation] Fire-and-forget consolidation failed', {
        conversationId,
        userId,
        error: getErrorMessage(err),
      });
    });
  }

  /**
   * Retrieve a stored conversation summary by ID.
   */
  async getConversationMemory(
    conversationId: string,
    userId: string,
  ): Promise<import('./memory-consolidation-types').ConversationMemory | null> {
    return getConversationMemory(conversationId, userId);
  }

  /**
   * List recent conversation memories for a user.
   */
  async listConversationMemories(
    userId: string,
    limit?: number,
  ): Promise<import('./memory-consolidation-types').ConversationMemory[]> {
    return listConversationMemories(userId, limit);
  }
}

// ── Fire-and-forget helper ────────────────────────────────────────────────────

function pruneOldMemoriesAsync(userId: string): void {
  pruneOldMemories(userId).catch((err) => {
    logger.warn('[MemoryConsolidation] Pruning failed', {
      userId,
      error: getErrorMessage(err),
    });
  });
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let consolidationServiceInstance: MemoryConsolidationService | null = null;

/**
 * Get the singleton MemoryConsolidationService instance.
 */
export function getMemoryConsolidationService(): MemoryConsolidationService {
  if (!consolidationServiceInstance) {
    consolidationServiceInstance = new MemoryConsolidationService();
  }
  return consolidationServiceInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetMemoryConsolidationService(): void {
  consolidationServiceInstance = null;
}

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { getContextManager } from '../context-manager';
import type { ConsolidationResult, ConversationMemory } from '../memory-consolidation-types';
import {
  storeSummaryAsync,
  getConversationMemory,
  listConversationMemories,
} from '../memory-consolidation-storage';
import { pruneOldMemoriesAsync } from './pruner';

/**
 * Orchestrates conversation memory consolidation for agent chat.
 */
export class MemoryConsolidationService {
  private readonly contextManager: ReturnType<typeof getContextManager>;

  constructor() {
    this.contextManager = getContextManager();
  }

  /**
   * Consolidate a conversation: check size, trim/summarize if needed,
   * store summary, and prune old memories.
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
      const systemPrompt = messages.find((m) => m.role === 'system')?.content ?? 'You are a helpful AI assistant.';
      const chatMessages = messages.filter((m) => m.role !== 'system');
      const contextResult = this.contextManager.checkContext(
        chatMessages,
        systemPrompt,
      );

      let trimmedMessages = [...messages];
      let summaryContent: string | null = null;

      if (contextResult.action === 'trim') {
        trimmedMessages = await this.contextManager.trimMessages(
          chatMessages,
          systemPrompt,
        );
      } else if (contextResult.action === 'summarize+trim') {
        const { summary, recent } = await this.contextManager.summarizeOlder(
          chatMessages,
          4,
        );

        if (summary) {
          summaryContent = summary.content;
          trimmedMessages = [
            { role: 'system', content: systemPrompt },
            summary,
            ...recent,
          ];
        } else {
          trimmedMessages = await this.contextManager.trimMessages(
            chatMessages,
            systemPrompt,
          );
        }
      }

      const tokensAfter = this.contextManager.estimateTokens(trimmedMessages);

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
  ): Promise<ConversationMemory | null> {
    return getConversationMemory(conversationId, userId);
  }

  /**
   * List recent conversation memories for a user.
   */
  async listConversationMemories(
    userId: string,
    limit?: number,
  ): Promise<ConversationMemory[]> {
    return listConversationMemories(userId, limit);
  }
}

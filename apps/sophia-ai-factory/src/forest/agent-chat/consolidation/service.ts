import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { getContextManager } from '../context-manager';
import type { ConsolidationResult, ConversationMemory } from '../memory-consolidation-types';
import {
  getConversationMemory,
  listConversationMemories,
} from '../memory-consolidation-storage';
import { runConversationConsolidation } from './consolidate-runner';

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
    return runConversationConsolidation(
      this.contextManager,
      conversationId,
      messages,
      userId,
    );
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

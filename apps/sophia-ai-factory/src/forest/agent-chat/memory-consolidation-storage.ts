/**
 * @module forest/agent-chat/memory-consolidation-storage
 *
 * Storage operations for conversation memory consolidation.
 * Handles reading/writing summaries and pruning old memories via the memory adapter.
 *
 * Import direction: forest → seed (ONE-WAY).
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  CONVERSATION_MEMORY_TYPE,
  CONVERSATION_KEY_PREFIX,
  type ConversationMemory,
} from './memory-consolidation-types';
import {
  getMemory,
  updateConversationIndex,
} from './memory-consolidation-adapter';
import { pruneOldMemories } from './memory-consolidation-pruning';

export { updateConversationIndex, pruneOldMemories };

/**
 * Retrieve a stored conversation summary by ID.
 */
export async function getConversationMemory(
  conversationId: string,
  userId: string,
): Promise<ConversationMemory | null> {
  const memory = await getMemory();
  try {
    const key = `${CONVERSATION_KEY_PREFIX}${conversationId}`;
    const stored = (await memory.query(
      CONVERSATION_MEMORY_TYPE,
      key,
      userId,
    )) as ConversationMemory | null;
    return stored ?? null;
  } catch (err) {
    logger.warn('[MemoryConsolidation] Failed to retrieve conversation memory', {
      conversationId,
      userId,
      error: getErrorMessage(err),
    });
    return null;
  }
}

/**
 * List recent conversation memories for a user.
 */
export async function listConversationMemories(
  userId: string,
  limit: number = 20,
): Promise<ConversationMemory[]> {
  const memory = await getMemory();
  try {
    const key = `${CONVERSATION_KEY_PREFIX}${userId}:index`;
    const index = (await memory.query(
      CONVERSATION_MEMORY_TYPE,
      key,
      userId,
    )) as string[] | undefined;
    if (!Array.isArray(index)) return [];

    const memories: ConversationMemory[] = [];
    for (const convId of index.slice(0, limit)) {
      const mem = await getConversationMemory(convId, userId);
      if (mem) memories.push(mem);
    }
    return memories;
  } catch (err) {
    logger.warn('[MemoryConsolidation] Failed to list conversation memories', {
      userId,
      error: getErrorMessage(err),
    });
    return [];
  }
}

/**
 * Store a conversation summary asynchronously.
 * Returns true if stored successfully, false on error.
 */
export async function storeSummaryAsync(
  conversationId: string,
  summary: string,
  messageCount: number,
  userId: string,
): Promise<boolean> {
  const memory = await getMemory();
  try {
    const key = `${CONVERSATION_KEY_PREFIX}${conversationId}`;
    const record: ConversationMemory = {
      id: conversationId,
      conversationId,
      summary,
      messageCount,
      lastConsolidatedAt: new Date().toISOString(),
    };
    await memory.store(CONVERSATION_MEMORY_TYPE, key, record, userId);
    await updateConversationIndex(conversationId, userId);
    return true;
  } catch (err) {
    logger.warn('[MemoryConsolidation] Failed to store summary', {
      conversationId,
      userId,
      error: getErrorMessage(err),
    });
    return false;
  }
}

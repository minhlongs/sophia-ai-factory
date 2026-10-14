/**
 * @module forest/agent-chat/memory-consolidation-adapter
 *
 * Lazy memory adapter loader and index management.
 */

import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import {
  CONVERSATION_MEMORY_TYPE,
  CONVERSATION_KEY_PREFIX,
  MAX_CONVERSATIONS_PER_USER,
} from './memory-consolidation-types';

export type MemoryAdapter = import('@/land/openclaw/memory-adapter').MemoryAdapter;
let memoryAdapter: MemoryAdapter | null = null;

export async function getMemory(): Promise<MemoryAdapter> {
  if (!memoryAdapter) {
    const mod = await import('@/land/openclaw/memory-adapter');
    memoryAdapter = mod.memory;
  }
  return memoryAdapter;
}

/**
 * Update the conversation index for a user.
 */
export async function updateConversationIndex(
  conversationId: string,
  userId: string,
): Promise<void> {
  const memory = await getMemory();
  try {
    const key = `${CONVERSATION_KEY_PREFIX}${userId}:index`;
    const existing = (await memory.query(
      CONVERSATION_MEMORY_TYPE,
      key,
      userId,
    )) as string[] | undefined;

    const index = Array.isArray(existing) ? [...existing] : [];
    const filtered = index.filter((id) => id !== conversationId);
    filtered.unshift(conversationId);
    const trimmed = filtered.slice(0, MAX_CONVERSATIONS_PER_USER);

    await memory.store(CONVERSATION_MEMORY_TYPE, key, trimmed, userId);
  } catch (err) {
    logger.warn('[MemoryConsolidation] Index update failed', {
      conversationId,
      userId,
      error: getErrorMessage(err),
    });
  }
}

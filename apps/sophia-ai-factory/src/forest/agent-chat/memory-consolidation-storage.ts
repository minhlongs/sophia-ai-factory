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
  CONVERSATION_RETENTION_MS,
  MAX_CONVERSATIONS_PER_USER,
  type ConversationMemory,
} from './memory-consolidation-types';

// ── Storage Adapter ───────────────────────────────────────────────────────────

type MemoryAdapter = import('@/land/openclaw/memory-adapter').MemoryAdapter;
let memoryAdapter: MemoryAdapter | null = null;

async function getMemory(): Promise<MemoryAdapter> {
  if (!memoryAdapter) {
    const mod = await import('@/land/openclaw/memory-adapter');
    memoryAdapter = mod.memory;
  }
  return memoryAdapter;
}

// ── Public Storage Functions ──────────────────────────────────────────────────

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

/**
 * Prune conversation memories older than the retention period.
 * Uses D1 directly for deletion since MemoryAdapter lacks a delete method.
 */
export async function pruneOldMemories(userId: string): Promise<void> {
  const memory = await getMemory();
  try {
    const cutoff = Date.now() - CONVERSATION_RETENTION_MS;
    const indexKey = `${CONVERSATION_KEY_PREFIX}${userId}:index`;
    const existing = (await memory.query(
      CONVERSATION_MEMORY_TYPE,
      indexKey,
      userId,
    )) as string[] | undefined;
    const index: string[] = existing ?? [];
    if (index.length === 0) return;

    const toDelete: string[] = [];
    for (const convId of index) {
      const mem = await getConversationMemory(convId, userId);
      if (mem && new Date(mem.lastConsolidatedAt).getTime() < cutoff) {
        toDelete.push(convId);
      }
    }

    if (toDelete.length > 0) {
      const { getD1 } = await import('@/seed/db/client');
      const db = getD1();
      if (db) {
        for (const convId of toDelete) {
          await db
            .prepare(
              'DELETE FROM memory_kv WHERE tenant_id = ? AND type = ? AND key_name = ?',
            )
            .bind(userId, CONVERSATION_MEMORY_TYPE, `${CONVERSATION_KEY_PREFIX}${convId}`)
            .run();
        }
        const remaining = index.filter((id) => !toDelete.includes(id));
        await memory.store(CONVERSATION_MEMORY_TYPE, indexKey, remaining, userId);
      }
    }
  } catch {
    // Silently ignore — pruning is non-critical.
  }
}

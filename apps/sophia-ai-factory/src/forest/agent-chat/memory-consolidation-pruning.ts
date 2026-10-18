/**
 * @module forest/agent-chat/memory-consolidation-pruning
 *
 * Pruning operations for expired conversation memories.
 *
 * Import direction: forest → seed (ONE-WAY).
 */

import {
  CONVERSATION_MEMORY_TYPE,
  CONVERSATION_KEY_PREFIX,
  CONVERSATION_RETENTION_MS,
} from './memory-consolidation-types';
import { getMemory } from './memory-consolidation-adapter';
import { getConversationMemory } from './memory-consolidation-storage';

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
      const db = await getD1();
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

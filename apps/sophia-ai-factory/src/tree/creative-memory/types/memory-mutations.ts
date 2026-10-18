/**
 * Creative Memory D1 Delete & Learning Helpers
 *
 * Layer: tree/creative-memory/types
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeMemory, MemoryCategory } from '@/seed/types/creative-domain';
import { CreativeMemoryError, newMemoryId } from './models';
import { upsertMemory } from './repository';

/**
 * Soft-delete memory by id.
 */
export async function deleteMemory(id: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');
  await db.prepare(`UPDATE creative_memory SET is_deleted = 1 WHERE id = ?1`).bind(id).run();
}

/**
 * Hard-delete memory by id.
 */
export async function purgeMemory(id: string): Promise<void> {
  const db = await getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');
  await db.prepare(`DELETE FROM creative_memory WHERE id = ?1`).bind(id).run();
}

/**
 * Record a learning event with evidence.
 */
export async function recordLearning(
  workspaceId: string,
  category: MemoryCategory,
  key: string,
  value: unknown,
  evidence: string,
  scope?: string,
  scopeId?: string,
): Promise<CreativeMemory> {
  return upsertMemory({
    id: newMemoryId(),
    workspaceId,
    category,
    key,
    value,
    confidence: 'medium',
    source: 'performance',
    evidence,
    scope: (scope ?? 'global') as CreativeMemory['scope'],
    scopeId,
    version: 0,
    isDeleted: false,
    createdAt: 0,
    updatedAt: 0,
  });
}

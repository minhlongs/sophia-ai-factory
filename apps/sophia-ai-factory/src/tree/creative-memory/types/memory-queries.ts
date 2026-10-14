/**
 * Creative Memory Query Functions
 *
 * Layer: tree/creative-memory/types
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeMemory, MemoryCategory } from '@/seed/types/creative-domain';
import {
  CreativeMemoryError,
  type CreativeMemoryRow,
  memoryRowToDomain,
} from './models';

/**
 * Query memory by category + key, optionally scoped.
 */
export async function getMemory(
  workspaceId: string,
  category: MemoryCategory,
  key: string,
  scope?: CreativeMemory['scope'],
  scopeId?: string,
): Promise<CreativeMemory | null> {
  const db = await getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');

  const row = await db
    .prepare(
      `SELECT * FROM creative_memory
       WHERE workspace_id = ?1 AND category = ?2 AND key = ?3 AND is_deleted = 0
         AND (expires_at IS NULL OR expires_at > ?4)
         AND (scope = ?5 OR (?5 IS NULL))
         AND (scope_id = ?6 OR (scope_id IS NULL AND ?6 IS NULL))
       ORDER BY version DESC LIMIT 1`,
    )
    .bind(workspaceId, category, key, Math.floor(Date.now() / 1000), scope ?? null, scopeId ?? null)
    .first<CreativeMemoryRow>();

  if (!row) return null;
  return memoryRowToDomain(row);
}

/**
 * Query memory by category only, optionally filtered by scope.
 */
export async function getMemoryByCategory(
  workspaceId: string,
  category: MemoryCategory,
  scope?: string,
  scopeId?: string,
): Promise<CreativeMemory[]> {
  const db = await getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);
  const result = await db
    .prepare(
      `SELECT * FROM creative_memory
       WHERE workspace_id = ?1 AND category = ?2 AND is_deleted = 0
         AND (expires_at IS NULL OR expires_at > ?3)
         AND (scope = ?4 OR (?4 IS NULL))
         AND (scope_id = ?5 OR (scope_id IS NULL AND ?5 IS NULL))
       ORDER BY version DESC`,
    )
    .bind(workspaceId, category, now, scope ?? null, scopeId ?? null)
    .all<CreativeMemoryRow>();

  return (result.results ?? []).map(memoryRowToDomain);
}

/**
 * List all memory keys for a workspace.
 */
export async function listMemoryKeys(
  workspaceId: string,
): Promise<Array<{ category: string; key: string; scope: string; updatedAt: number }>> {
  const db = await getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');

  const result = await db
    .prepare(
      `SELECT category, key, scope, updated_at as updatedAt FROM creative_memory
       WHERE workspace_id = ?1 AND is_deleted = 0
       ORDER BY updated_at DESC`,
    )
    .bind(workspaceId)
    .all<{ category: string; key: string; scope: string; updatedAt: number }>();

  return result.results ?? [];
}

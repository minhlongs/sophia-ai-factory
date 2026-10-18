/**
 * Creative Memory D1 Repository Implementation
 *
 * Layer: tree/creative-memory/types
 */

import { getD1 } from '@/seed/db/client';
import type { CreativeMemory } from '@/seed/types/creative-domain';
import {
  CreativeMemoryError,
  newMemoryId,
} from './models';

export * from './memory-queries';
export { deleteMemory, purgeMemory, recordLearning } from './memory-mutations';

/**
 * Store or update a memory entry.
 * Upserts by (workspace_id, category, key, scope, scope_id).
 * Increments version on update.
 */
export async function upsertMemory(entry: CreativeMemory): Promise<CreativeMemory> {
  const db = await getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');

  const now = Math.floor(Date.now() / 1000);

  // Try update first (existing version + 1)
  const existing = await db
    .prepare(
      `SELECT id, version FROM creative_memory
       WHERE workspace_id = ?1 AND category = ?2 AND key = ?3 AND scope = ?4
         AND (scope_id = ?5 OR (scope_id IS NULL AND ?5 IS NULL))
       LIMIT 1`,
    )
    .bind(entry.workspaceId, entry.category, entry.key, entry.scope, entry.scopeId ?? null)
    .first<{ id: string; version: number }>();

  if (existing) {
    const newVersion = existing.version + 1;
    await db
      .prepare(
        `UPDATE creative_memory SET
           value = ?, confidence = ?, source = ?, evidence = ?,
           version = ?, updated_at = ?, expires_at = ?, is_deleted = ?
         WHERE id = ?1`,
      )
      .bind(
        JSON.stringify(entry.value),
        entry.confidence,
        entry.source,
        entry.evidence,
        newVersion,
        now,
        entry.expiresAt ?? null,
        entry.isDeleted ? 1 : 0,
        existing.id,
      )
      .run();
    return { ...entry, version: newVersion, updatedAt: now };
  }

  // Insert new
  entry.id = entry.id || newMemoryId();
  entry.createdAt = now;
  entry.updatedAt = now;
  entry.version = 1;

  await db
    .prepare(
      `INSERT INTO creative_memory
         (id, workspace_id, category, key, value, confidence, source, evidence,
          scope, scope_id, version, is_deleted, created_at, updated_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      entry.id,
      entry.workspaceId,
      entry.category,
      entry.key,
      JSON.stringify(entry.value),
      entry.confidence,
      entry.source,
      entry.evidence,
      entry.scope,
      entry.scopeId ?? null,
      1,
      entry.isDeleted ? 1 : 0,
      now,
      now,
      entry.expiresAt ?? null,
    )
    .run();

  return entry;
}

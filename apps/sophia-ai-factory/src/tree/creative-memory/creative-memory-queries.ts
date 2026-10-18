/**
 * D1 query helpers for CreativeMemoryStore
 *
 * Layer: tree. Imports seed only (types, db client) and local types.
 *
 * @module tree/creative-memory/creative-memory-queries
 */

import type { CreativeMemory } from '@/seed/types/creative-domain';
import type { MemoryQuery } from '@/seed/types/creative-economy';
import { getD1 } from '@/seed/db/client';
import { memoryRowToDomain, CreativeMemoryError } from './types';

export async function fetchMemoryById(id: string): Promise<CreativeMemory | null> {
  const db = await getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');
  const row = await db
    .prepare(
      `SELECT id, workspace_id, category, key, value, confidence, source,
              evidence, scope, scope_id, version, is_deleted,
              created_at, updated_at, expires_at
       FROM creative_memory
       WHERE id = ?1 AND is_deleted = 0`,
    )
    .bind(id)
    .first<Parameters<typeof memoryRowToDomain>[0]>();
  if (!row) return null;
  return memoryRowToDomain(row);
}

export async function executeMemoryQuery(query: MemoryQuery): Promise<CreativeMemory[]> {
  const db = await getD1();
  if (!db) throw new CreativeMemoryError('D1_UNAVAILABLE', 'D1 not available');
  const now = Math.floor(Date.now() / 1000);
  const params: unknown[] = [query.workspaceId, now];
  let sql =
    `SELECT * FROM creative_memory` +
    ` WHERE workspace_id = ?1 AND is_deleted = 0` +
    ` AND (expires_at IS NULL OR expires_at > ?2)`;
  if (query.category) {
    sql += ` AND category = ?${params.length + 1}`;
    params.push(query.category);
  }
  if (query.key) {
    sql += ` AND key = ?${params.length + 1}`;
    params.push(query.key);
  }
  sql += ` AND (scope = ?${params.length + 1} OR (?${params.length + 1} IS NULL))`;
  params.push(query.scope ?? null);
  sql +=
    ` AND (scope_id = ?${params.length + 1} OR (scope_id IS NULL AND ?${params.length + 1} IS NULL))`;
  params.push(query.scopeId ?? null);
  sql += ` ORDER BY updated_at DESC, id DESC`;
  if (query.limit) {
    sql += ` LIMIT ?${params.length + 1}`;
    params.push(query.limit);
  }
  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<Parameters<typeof memoryRowToDomain>[0]>();
  return (result.results ?? []).map(memoryRowToDomain);
}

/**
 * Memory Query SQL Construction and Row Mapping Helpers
 *
 * @module tree/memory/repository/query-builder
 */

import type { CreatorMemoryType } from '@/seed/db/types';
import type {
  MemoryContent,
  MemoryQueryOptions,
  RawCreatorMemoryRow,
  StoredMemory,
} from './types';
import { DEFAULT_LIMIT } from './types';

export interface BuiltMemoryQuery {
  sql: string;
  bindings: unknown[];
}

/**
 * Builds parameterized SQL statement and bindings for querying memories.
 */
export function buildMemoryQuery(
  userId: string,
  nowMs: number,
  opts?: MemoryQueryOptions,
): BuiltMemoryQuery {
  const conditions: string[] = [
    'user_id = ?1',
    '(expires_at IS NULL OR expires_at > ?2)',
  ];
  const bindings: unknown[] = [userId, nowMs];
  let paramIdx = 3;

  if (opts?.type) {
    conditions.push(`memory_type = ?${paramIdx++}`);
    bindings.push(opts.type);
  }
  if (opts?.category) {
    conditions.push(`category = ?${paramIdx++}`);
    bindings.push(opts.category);
  }
  if (opts?.minRelevance !== undefined) {
    conditions.push(`relevance_score >= ?${paramIdx++}`);
    bindings.push(opts.minRelevance);
  }

  const limit = opts?.limit ?? DEFAULT_LIMIT;
  bindings.push(limit);

  const where = `WHERE ${conditions.join(' AND ')}`;
  const sql = `
    SELECT id, user_id, memory_type, category, content_json,
      relevance_score, source_execution_id, expires_at,
      created_at, updated_at
    FROM creator_memory
    ${where}
    ORDER BY relevance_score DESC
    LIMIT ?${paramIdx}
  `;

  return { sql, bindings };
}

/**
 * Converts a raw D1 database row into a typed StoredMemory entity.
 */
export function rowToMemory(row: RawCreatorMemoryRow): StoredMemory {
  let content: MemoryContent;
  try {
    content = JSON.parse(row.content_json) as MemoryContent;
  } catch {
    content = { text: row.content_json };
  }
  return {
    id: row.id,
    userId: row.user_id,
    memoryType: row.memory_type as CreatorMemoryType,
    category: row.category,
    content,
    relevanceScore: row.relevance_score,
    sourceExecutionId: row.source_execution_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

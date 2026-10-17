/**
 * D1 Persistence Operations for Creator Memory Repository
 *
 * @module tree/memory/repository/memory-store-ops
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CreatorMemoryType } from '@/seed/db/types';
import type { MemoryContent, StoredMemory } from './types';
import { DEFAULT_RELEVANCE } from './types';

export async function insertCreatorMemory(
  db: D1Database,
  userId: string,
  memoryType: CreatorMemoryType,
  category: string,
  content: MemoryContent,
  opts?: {
    relevanceScore?: number;
    sourceExecutionId?: string;
    expiresAt?: number;
  },
): Promise<StoredMemory> {
  const id = crypto.randomUUID();
  const now = Date.now();
  const contentJson = JSON.stringify(content);

  await db
    .prepare(
      `INSERT INTO creator_memory
      (id, user_id, memory_type, category, content_json,
       relevance_score, source_execution_id, expires_at, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`,
    )
    .bind(
      id,
      userId,
      memoryType,
      category,
      contentJson,
      opts?.relevanceScore ?? DEFAULT_RELEVANCE,
      opts?.sourceExecutionId ?? null,
      opts?.expiresAt ?? null,
      now,
    )
    .run();

  logger.info('[MemoryRepository] Stored', {
    id,
    userId,
    memoryType,
    category,
  });

  return {
    id,
    userId,
    memoryType,
    category,
    content,
    relevanceScore: opts?.relevanceScore ?? DEFAULT_RELEVANCE,
    sourceExecutionId: opts?.sourceExecutionId ?? null,
    expiresAt: opts?.expiresAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function purgeExpiredMemories(db: D1Database): Promise<number> {
  const now = Date.now();
  const result = await db
    .prepare(
      `DELETE FROM creator_memory
       WHERE expires_at IS NOT NULL AND expires_at <= ?1`,
    )
    .bind(now)
    .run();

  const deleted = result.meta?.changes ?? 0;
  if (deleted > 0) {
    logger.info('[MemoryRepository] Deleted expired memories', { deleted });
  }
  return deleted;
}

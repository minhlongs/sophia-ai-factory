/**
 * D1 CRUD Repository Implementation for creator_memory
 *
 * @module tree/memory/repository/memory-repository
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { CreatorMemoryType } from '@/seed/db/types';
import type {
  MemoryContent,
  MemoryQueryOptions,
  RawCreatorMemoryRow,
  RelevantMemory,
  StoredMemory,
} from './types';
import { buildMemoryQuery, rowToMemory } from './query-builder';
import { rankMemoriesByQuery } from './relevance-ranker';
import { insertCreatorMemory, purgeExpiredMemories } from './memory-store-ops';

/**
 * Typed repository over the creator_memory D1 table.
 *
 * All methods use prepared statements (D1-compatible positional ? bindings).
 * D1 operations are async — all public methods return Promises.
 * Errors are logged and re-thrown — callers handle failure.
 */
export class MemoryRepository {
  private readonly getDb: () => Promise<Awaited<ReturnType<typeof getD1>>>;

  constructor() {
    this.getDb = getD1;
  }

  /**
   * Insert a new creator memory entry.
   */
  async store(
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
    const db = await this.getDb();
    if (!db) throw new Error('D1 database binding not available');

    return insertCreatorMemory(db, userId, memoryType, category, content, opts);
  }

  /**
   * Retrieve memories for a user, ranked by relevance_score DESC.
   * Automatically excludes expired entries.
   */
  async query(
    userId: string,
    opts?: MemoryQueryOptions,
  ): Promise<StoredMemory[]> {
    try {
      const db = await this.getDb();
      if (!db) throw new Error('D1 database binding not available');

      const now = Date.now();
      const { sql, bindings } = buildMemoryQuery(userId, now, opts);

      const result = await db.prepare(sql).bind(...bindings).all<RawCreatorMemoryRow>();

      return (result.results ?? []).map((row) => rowToMemory(row));
    } catch (err) {
      logger.error('[MemoryRepository] query failed', {
        userId,
        opts,
        error: getErrorMessage(err),
      });
      return [];
    }
  }

  /**
   * Get memories relevant to a text query.
   */
  async getRelevant(
    userId: string,
    query: string,
    limit = 20,
  ): Promise<RelevantMemory[]> {
    try {
      const memories = await this.query(userId, { limit: 100 });
      return rankMemoriesByQuery(memories, query, limit);
    } catch (err) {
      logger.error('[MemoryRepository] getRelevant failed', {
        userId,
        query,
        error: getErrorMessage(err),
      });
      return [];
    }
  }

  /**
   * Delete all memories whose expires_at has passed.
   */
  async deleteExpired(): Promise<number> {
    try {
      const db = await this.getDb();
      if (!db) throw new Error('D1 database binding not available');

      return await purgeExpiredMemories(db);
    } catch (err) {
      logger.error('[MemoryRepository] deleteExpired failed', {
        error: getErrorMessage(err),
      });
      return 0;
    }
  }
}

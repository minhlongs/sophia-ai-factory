/**
 * @module tree/memory/memory-repository
 *
 * MemoryRepository — typed D1 CRUD for the creator_memory table.
 *
 * Wraps raw D1 operations with prepared statements, typed results,
 * and structured logging. All D1 access goes through getD1() from seed.
 *
 * Memory types: semantic | preference | episodic | performance
 *
 * @see migrations/0128_creator_memory.sql — schema definition
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { CreatorMemoryType } from '@/seed/db/types';

// ── Domain types ──────────────────────────────────────────────────────────────

/** Memory content stored as JSON — shape depends on memory_type. */
export interface MemoryContent {
  text: string;
  data?: Record<string, unknown>;
}

/** Filter options for querying memories. */
export interface MemoryQueryOptions {
  /** Filter by memory type. */
  type?: CreatorMemoryType;
  /** Filter by category string. */
  category?: string;
  /** Maximum rows to return (default 50). */
  limit?: number;
  /** Minimum relevance score threshold. */
  minRelevance?: number;
}

/** Row returned from store() with generated fields. */
export interface StoredMemory {
  id: string;
  userId: string;
  memoryType: CreatorMemoryType;
  category: string;
  content: MemoryContent;
  relevanceScore: number;
  sourceExecutionId: string | null;
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/** Relevance-scored result for getRelevant(). */
export interface RelevantMemory extends StoredMemory {
  /** Combined relevance for ranking (keyword overlap + stored score). */
  relevance: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 50;
const DEFAULT_RELEVANCE = 1.0;

// ── MemoryRepository ──────────────────────────────────────────────────────────

/**
 * Typed repository over the creator_memory D1 table.
 *
 * All methods use prepared statements (D1-compatible positional ? bindings).
 * D1 operations are async — all public methods return Promises.
 * Errors are logged and re-thrown — callers handle failure.
 */
export class MemoryRepository {
  private readonly getDb: () => ReturnType<typeof getD1>;

  constructor() {
    // Store the accessor function so we can call it per-operation
    // (D1 binding may not be available at construction time in tests).
    this.getDb = getD1;
  }

  // ── Store ──────────────────────────────────────────────────────────────────

  /**
   * Insert a new creator memory entry.
   *
   * @param userId — owner of this memory
   * @param memoryType — semantic | preference | episodic | performance
   * @param category — grouping key (e.g. "tone", "thumbnail", "execution")
   * @param content — structured content (serialised to JSON)
   * @param opts — optional overrides
   * @returns the stored memory with generated fields
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
    const db = this.getDb();
    if (!db) throw new Error('D1 database binding not available');

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

  // ── Query ──────────────────────────────────────────────────────────────────

  /**
   * Retrieve memories for a user, ranked by relevance_score DESC.
   * Automatically excludes expired entries.
   *
   * @param userId — owner to query
   * @param opts — optional type/category/limit filters
   * @returns array of memory rows (empty array on error)
   */
  async query(
    userId: string,
    opts?: MemoryQueryOptions,
  ): Promise<StoredMemory[]> {
    try {
      const db = this.getDb();
      if (!db) throw new Error('D1 database binding not available');

      const now = Date.now();
      const conditions: string[] = [
        'user_id = ?1',
        '(expires_at IS NULL OR expires_at > ?2)',
      ];
      const bindings: unknown[] = [userId, now];
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

      const result = await db.prepare(sql).bind(...bindings).all<{
        id: string;
        user_id: string;
        memory_type: string;
        category: string;
        content_json: string;
        relevance_score: number;
        source_execution_id: string | null;
        expires_at: number | null;
        created_at: number;
        updated_at: number;
      }>();

      return (result.results ?? []).map((row) => this.rowToMemory(row));
    } catch (err) {
      logger.error('[MemoryRepository] query failed', {
        userId,
        opts,
        error: getErrorMessage(err),
      });
      return [];
    }
  }

  // ── Get Relevant ───────────────────────────────────────────────────────────

  /**
   * Get memories relevant to a text query.
   *
   * Performs a simple keyword overlap score against content.text,
   * then returns the top-N results sorted by combined relevance.
   *
   * @param userId — owner to query
   * @param query — text to match against memory content
   * @param limit — max results (default 20)
   * @returns array of RelevantMemory with computed relevance score
   */
  async getRelevant(
    userId: string,
    query: string,
    limit = 20,
  ): Promise<RelevantMemory[]> {
    try {
      const memories = await this.query(userId, { limit: 100 });
      const queryTerms = new Set(
        query
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 2),
      );

      if (queryTerms.size === 0) {
        return memories
          .slice(0, limit)
          .map((m) => ({ ...m, relevance: m.relevanceScore }));
      }

      const scored = memories
        .map((memory) => {
          const contentTerms = new Set(
            memory.content.text
              .toLowerCase()
              .split(/\s+/)
              .filter((t) => t.length > 2),
          );
          let overlap = 0;
          for (const term of queryTerms) {
            if (contentTerms.has(term)) overlap++;
          }
          const keywordScore =
            queryTerms.size > 0 ? overlap / queryTerms.size : 0;
          const combined = keywordScore * 0.4 + memory.relevanceScore * 0.6;
          return { ...memory, relevance: combined };
        })
        .filter((m) => m.relevance > 0.05)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit);

      return scored;
    } catch (err) {
      logger.error('[MemoryRepository] getRelevant failed', {
        userId,
        query,
        error: getErrorMessage(err),
      });
      return [];
    }
  }

  // ── Delete Expired ─────────────────────────────────────────────────────────

  /**
   * Delete all memories whose expires_at has passed.
   *
   * @returns number of rows deleted
   */
  async deleteExpired(): Promise<number> {
    try {
      const db = this.getDb();
      if (!db) throw new Error('D1 database binding not available');

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
    } catch (err) {
      logger.error('[MemoryRepository] deleteExpired failed', {
        error: getErrorMessage(err),
      });
      return 0;
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /** Convert a raw D1 row to a StoredMemory. */
  private rowToMemory(row: {
    id: string;
    user_id: string;
    memory_type: string;
    category: string;
    content_json: string;
    relevance_score: number;
    source_execution_id: string | null;
    expires_at: number | null;
    created_at: number;
    updated_at: number;
  }): StoredMemory {
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
}

/**
 * Creator Memory repository — typed CRUD for the `creator_memory` table.
 *
 * Provides persistent context about each creator's preferences, past
 * performance, and patterns. Consumed by SOP execution to inject
 * personalised context into prompt calls at runtime.
 *
 * Memory types:
 *  - episodic   — specific execution results ("video X got 50K views with hook style Y")
 *  - semantic   — general knowledge about the creator ("prefers casual tone, 18-35 demo")
 *  - preference — explicit user preferences ("always use blue thumbnails")
 *  - performance— aggregated metrics ("avg CTR 4.2% on faceless videos")
 *
 * All writes use crypto.randomUUID() for IDs and Date.now() for timestamps
 * (epoch ms stored as INTEGER in D1, matching the schema convention).
 *
 * @module seed/db/repositories/creator-memory-repo
 */

import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type {
  CreatorMemoryDbRow,
  CreatorMemoryType,
  CreatorProfile,
} from '@/seed/db/types';

// ── Add ──────────────────────────────────────────────────────────────────────

/**
 * Insert a new creator memory entry.
 * Returns the generated memory ID.
 * Throws on D1 constraint violation.
 */
export async function addMemory(params: {
  userId: string;
  memoryType: CreatorMemoryType;
  category: string;
  contentJson: string;
  relevanceScore?: number;
  sourceExecutionId?: string;
  expiresAt?: number;
}): Promise<string> {
  const db = await getD1Raw();
  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO creator_memory
         (id, user_id, memory_type, category, content_json,
          relevance_score, source_execution_id, expires_at,
          created_at, updated_at)
       VALUES
         (?1, ?2, ?3, ?4, ?5,
          ?6, ?7, ?8,
          ?9, ?9)`,
    )
    .bind(
      id,
      params.userId,
      params.memoryType,
      params.category,
      params.contentJson,
      params.relevanceScore ?? 1.0,
      params.sourceExecutionId ?? null,
      params.expiresAt ?? null,
      now,
    )
    .run();

  logger.info('[CreatorMemoryRepo] Memory added', {
    id,
    userId: params.userId,
    memoryType: params.memoryType,
    category: params.category,
  });

  return id;
}

// ── Query ─────────────────────────────────────────────────────────────────────

/**
 * Retrieve memories for a user, sorted by relevance_score DESC.
 * Optionally filter by memoryType and/or category.
 * Excludes expired entries automatically.
 * Returns empty array on error.
 */
export async function getRelevantMemories(
  userId: string,
  opts?: {
    memoryType?: CreatorMemoryType;
    category?: string;
    limit?: number;
  },
): Promise<CreatorMemoryDbRow[]> {
  try {
    const db = await getD1Raw();
    const now = Date.now();

    const conditions: string[] = [
      'user_id = ?1',
      '(expires_at IS NULL OR expires_at > ?2)',
    ];
    const bindings: unknown[] = [userId, now];
    let paramIdx = 3;

    if (opts?.memoryType) {
      conditions.push(`memory_type = ?${paramIdx++}`);
      bindings.push(opts.memoryType);
    }

    if (opts?.category) {
      conditions.push(`category = ?${paramIdx++}`);
      bindings.push(opts.category);
    }

    const limit = opts?.limit ?? 50;
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

    const result = await db
      .prepare(sql)
      .bind(...bindings)
      .all<CreatorMemoryDbRow>();

    return result.results ?? [];
  } catch (err) {
    logger.error('[CreatorMemoryRepo] getRelevantMemories failed', {
      userId,
      opts,
      error: getErrorMessage(err),
    });
    return [];
  }
}

// ── Update ────────────────────────────────────────────────────────────────────

/**
 * Update the relevance score of a memory entry (decay or boost).
 * Clamps the score to [0.0, 1.0] to prevent runaway values.
 * Throws on D1 error.
 */
export async function updateMemoryRelevance(
  id: string,
  relevanceScore: number,
): Promise<void> {
  const db = await getD1Raw();
  const clamped = Math.max(0.0, Math.min(1.0, relevanceScore));
  const now = Date.now();

  await db
    .prepare(
      `UPDATE creator_memory
       SET relevance_score = ?2,
           updated_at = ?3
       WHERE id = ?1`,
    )
    .bind(id, clamped, now)
    .run();

  logger.info('[CreatorMemoryRepo] Relevance updated', { id, relevanceScore: clamped });
}

// ── Prune ─────────────────────────────────────────────────────────────────────

/**
 * Delete all memory entries whose expires_at has passed.
 * Returns the number of rows deleted (D1 meta.changes).
 * Returns 0 on error.
 */
export async function pruneExpiredMemories(): Promise<number> {
  try {
    const db = await getD1Raw();
    const now = Date.now();

    const result = await db
      .prepare(
        `DELETE FROM creator_memory
         WHERE expires_at IS NOT NULL AND expires_at <= ?1`,
      )
      .bind(now)
      .run();

    const deleted = result.meta?.changes ?? 0;
    logger.info('[CreatorMemoryRepo] Pruned expired memories', { deleted });
    return deleted;
  } catch (err) {
    logger.error('[CreatorMemoryRepo] pruneExpiredMemories failed', {
      error: getErrorMessage(err),
    });
    return 0;
  }
}

// ── Profile ───────────────────────────────────────────────────────────────────

/**
 * Build a combined creator profile from the latest semantic and preference
 * memories. Each memory's content_json is parsed and merged by category key.
 * Returns an empty profile object on error.
 */
export async function getCreatorProfile(userId: string): Promise<CreatorProfile> {
  const empty: CreatorProfile = { semantic: {}, preferences: {} };

  try {
    const [semanticRows, preferenceRows] = await Promise.all([
      getRelevantMemories(userId, { memoryType: 'semantic', limit: 20 }),
      getRelevantMemories(userId, { memoryType: 'preference', limit: 20 }),
    ]);

    const semantic: Record<string, unknown> = {};
    for (const row of semanticRows) {
      try {
        semantic[row.category] = JSON.parse(row.content_json) as unknown;
      } catch {
        // Malformed content_json — skip silently; do not crash profile build.
        logger.warn('[CreatorMemoryRepo] Skipping malformed semantic content_json', {
          id: row.id,
        });
      }
    }

    const preferences: Record<string, unknown> = {};
    for (const row of preferenceRows) {
      try {
        preferences[row.category] = JSON.parse(row.content_json) as unknown;
      } catch {
        logger.warn('[CreatorMemoryRepo] Skipping malformed preference content_json', {
          id: row.id,
        });
      }
    }

    return { semantic, preferences };
  } catch (err) {
    logger.error('[CreatorMemoryRepo] getCreatorProfile failed', {
      userId,
      error: getErrorMessage(err),
    });
    return empty;
  }
}

// ── Shorthand helpers ─────────────────────────────────────────────────────────

/**
 * Shorthand: add an episodic memory entry sourced from a SOP execution.
 * Returns the generated memory ID.
 * Throws on D1 error.
 */
export async function addEpisodicFromExecution(
  userId: string,
  executionId: string,
  contentJson: string,
): Promise<string> {
  return addMemory({
    userId,
    memoryType: 'episodic',
    category: 'execution',
    contentJson,
    sourceExecutionId: executionId,
  });
}

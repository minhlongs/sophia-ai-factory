import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type {
  CreatorMemoryDbRow,
  CreatorProfile,
  GetRelevantMemoriesOpts,
} from './types';

/**
 * Retrieve memories for a user, sorted by relevance_score DESC.
 * Optionally filter by memoryType and/or category.
 * Excludes expired entries automatically.
 * Returns empty array on error.
 */
export async function getRelevantMemories(
  userId: string,
  opts?: GetRelevantMemoriesOpts,
): Promise<CreatorMemoryDbRow[]> {
  try {
    const db = await getD1();
    if (!db) throw new Error('D1 binding not available');
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

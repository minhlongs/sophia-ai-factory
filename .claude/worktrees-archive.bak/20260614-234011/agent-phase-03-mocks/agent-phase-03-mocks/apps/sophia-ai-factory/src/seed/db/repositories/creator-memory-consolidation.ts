/**
 * Memory consolidation — episodic → semantic extraction.
 *
 * Groups recent episodic memories by category, merges content,
 * creates one semantic entry per category. Idempotent via updated_at guard.
 *
 * @module seed/db/repositories/creator-memory-consolidation
 */

import { getD1Raw } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CreatorMemoryDbRow } from '@/seed/db/types';
import { addMemory } from './creator-memory-repo';

export interface ConsolidationSummary {
  userId: string;
  episodicCount: number;
  semanticCreated: number;
  categories: string[];
  consolidatedAt: number;
}

/**
 * Consolidate recent episodic memories into semantic memories.
 * Groups episodic entries by category, merges content, creates one semantic
 * entry per category. Marks originals via updated_at bump to avoid re-processing.
 *
 * Idempotent: skips episodic entries already consolidated (updated_at > created_at + 1000).
 */
export async function consolidateEpisodicToSemantic(
  userId: string,
  opts?: { sincMs?: number; limit?: number },
): Promise<ConsolidationSummary> {
  const db = await getD1Raw();
  const now = Date.now();
  const since = opts?.sincMs ?? now - 86_400_000;
  const limit = opts?.limit ?? 200;

  const rows = await db
    .prepare(
      `SELECT id, category, content_json, relevance_score, source_execution_id, created_at, updated_at
       FROM creator_memory
       WHERE user_id = ?1
         AND memory_type = 'episodic'
         AND created_at >= ?2
         AND (updated_at - created_at) < 1000
       ORDER BY created_at DESC
       LIMIT ?3`,
    )
    .bind(userId, since, limit)
    .all<CreatorMemoryDbRow>();

  const episodic = rows.results ?? [];
  if (episodic.length === 0) {
    return { userId, episodicCount: 0, semanticCreated: 0, categories: [], consolidatedAt: now };
  }

  const grouped = new Map<string, CreatorMemoryDbRow[]>();
  for (const row of episodic) {
    const existing = grouped.get(row.category) ?? [];
    existing.push(row);
    grouped.set(row.category, existing);
  }

  let semanticCreated = 0;
  const categories: string[] = [];

  for (const [category, entries] of grouped) {
    const contents: unknown[] = [];
    for (const entry of entries) {
      try {
        contents.push(JSON.parse(entry.content_json) as unknown);
      } catch {
        contents.push({ raw: entry.content_json });
      }
    }

    const avgRelevance =
      entries.reduce((sum, e) => sum + e.relevance_score, 0) / entries.length;

    const consolidated = {
      consolidatedFrom: entries.length,
      entries: contents,
      consolidatedAt: now,
    };

    await addMemory({
      userId,
      memoryType: 'semantic',
      category: `consolidated:${category}`,
      contentJson: JSON.stringify(consolidated),
      relevanceScore: Math.min(1.0, avgRelevance + 0.1),
      sourceExecutionId: entries[0]?.source_execution_id ?? undefined,
    });
    semanticCreated++;
    categories.push(category);

    const ids = entries.map((e) => e.id);
    const placeholders = ids.map((_, i) => `?${i + 2}`).join(',');
    await db
      .prepare(
        `UPDATE creator_memory SET updated_at = ?1 WHERE id IN (${placeholders})`,
      )
      .bind(now + 2000, ...ids)
      .run();
  }

  logger.info('[CreatorMemoryRepo] Consolidation complete', {
    userId,
    episodicCount: episodic.length,
    semanticCreated,
    categories,
  });

  return { userId, episodicCount: episodic.length, semanticCreated, categories, consolidatedAt: now };
}

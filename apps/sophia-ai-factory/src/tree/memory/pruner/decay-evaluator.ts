import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { D1, PruneConfig } from './types';

/**
 * Halve the relevance_score of stale memories.
 * Only affects non-preference types.
 */
export async function decayRelevanceScores(
  db: D1,
  config: PruneConfig,
): Promise<number> {
  try {
    const cutoff = Date.now() - config.decayPeriodDays * 24 * 60 * 60 * 1000;

    const result = await db
      .prepare(
        `UPDATE creator_memory
         SET relevance_score = relevance_score * ?1,
             updated_at = ?2
         WHERE updated_at < ?3
         AND expires_at IS NULL
         AND memory_type != 'preference'`,
      )
      .bind(config.decayFactor, Date.now(), cutoff)
      .run();

    const decayed = result.meta?.changes ?? 0;

    if (decayed > 0) {
      logger.info('[MemoryPruner] Decayed relevance', undefined, {
        decayed,
        decayFactor: config.decayFactor,
        cutoff: new Date(cutoff).toISOString(),
      } as Record<string, unknown>);
    }

    return decayed;
  } catch (err) {
    logger.error('[MemoryPruner] decayRelevance failed', undefined, {
      error: getErrorMessage(err),
    } as Record<string, unknown>);
    return 0;
  }
}

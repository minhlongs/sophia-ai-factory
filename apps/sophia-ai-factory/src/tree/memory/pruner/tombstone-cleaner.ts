import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { D1, PruneConfig } from './types';

/**
 * Remove expired memories from creator_memory.
 *
 * Safety: user-created preferences (memory_type = 'preference') are
 * NEVER auto-expired via soft expiry. They can only be removed if
 * they have an explicit expires_at that has passed.
 */
export async function pruneExpiredMemories(
  db: D1,
  config: PruneConfig,
): Promise<number> {
  try {
    const now = Date.now();
    const softCutoff = now - config.expiryDays * 24 * 60 * 60 * 1000;

    // Pass 1: explicit expires_at (all types, including preferences)
    const explicitResult = await db
      .prepare(
        `DELETE FROM creator_memory
         WHERE expires_at IS NOT NULL
         AND expires_at <= ?1`,
      )
      .bind(now)
      .run();

    // Pass 2: soft expiry — old rows without explicit expires_at
    // SAFETY: skip 'preference' type — user preferences are persistent
    const softResult = await db
      .prepare(
        `DELETE FROM creator_memory
         WHERE expires_at IS NULL
         AND created_at < ?1
         AND memory_type != 'preference'`,
      )
      .bind(softCutoff)
      .run();

    const explicitDeleted = explicitResult.meta?.changes ?? 0;
    const softDeleted = softResult.meta?.changes ?? 0;
    const totalDeleted = explicitDeleted + softDeleted;

    if (totalDeleted > 0) {
      logger.info('[MemoryPruner] Pruned expired memories', undefined, {
        explicitDeleted,
        softDeleted,
        totalDeleted,
        expiryDays: config.expiryDays,
      } as Record<string, unknown>);
    }

    return totalDeleted;
  } catch (err) {
    logger.error('[MemoryPruner] pruneExpired failed', undefined, {
      error: getErrorMessage(err),
    } as Record<string, unknown>);
    return 0;
  }
}

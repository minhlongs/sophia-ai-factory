import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import { pruneOldMemories } from '../memory-consolidation-storage';

/**
 * Fire-and-forget helper to prune old memories asynchronously.
 */
export function pruneOldMemoriesAsync(userId: string): void {
  pruneOldMemories(userId).catch((err) => {
    logger.warn('[MemoryConsolidation] Pruning failed', {
      userId,
      error: getErrorMessage(err),
    });
  });
}

/**
 * Market Signals Lifecycle Operations (Consumption & Expiry Cleanup)
 *
 * Layer: tree/market-signals/store
 * @module tree/market-signals/store/signal-lifecycle-ops
 */

import { createServerClient } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';

function getDb() {
  const client = createServerClient();
  return client.unwrap();
}

/** Mark signals as consumed. */
export async function consumeSignals(
  workspaceId: string,
  ids: string[],
): Promise<Result<number, Error>> {
  if (ids.length === 0) return success(0);

  try {
    const db = getDb();
    const placeholders = ids.map(() => '?').join(',');
    const result = await db
      .prepare(
        `UPDATE market_signals SET consumed = 1 WHERE workspace_id = ? AND id IN (${placeholders})`,
      )
      .bind(workspaceId, ...ids)
      .run();
    return success(result.meta?.changes ?? 0);
  } catch (err) {
    logger.error('[market-signals.store] consumeSignals failed', {
      workspaceId,
      ids,
      error: String(err),
    });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}

/** Delete expired signals (cleanup). */
export async function deleteExpiredSignals(
  workspaceId?: string,
): Promise<Result<number, Error>> {
  try {
    const db = getDb();
    const now = Date.now();
    let result;
    if (workspaceId) {
      result = await db
        .prepare(
          `DELETE FROM market_signals WHERE expires_at IS NOT NULL AND expires_at <= ? AND workspace_id = ?`,
        )
        .bind(now, workspaceId)
        .run();
    } else {
      result = await db
        .prepare(
          `DELETE FROM market_signals WHERE expires_at IS NOT NULL AND expires_at <= ?`,
        )
        .bind(now)
        .run();
    }
    return success(result.meta?.changes ?? 0);
  } catch (err) {
    logger.error('[market-signals.store] deleteExpiredSignals failed', {
      error: String(err),
    });
    return failure(err instanceof Error ? err : new Error(String(err)));
  }
}

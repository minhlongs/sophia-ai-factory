import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';

/** Dismiss alert (hide from dashboard). Returns true if successful. */
export async function dismissAlert(
  alertId: string,
  userId: string
): Promise<boolean> {
  try {
    const db = createServerClient();

    const { error } = await db
      .from('user_alerts')
      .update({
        dismissed: true,
        dismissed_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('user_id', userId);

    if (error) {
      logger.error('[Realtime Alert] Failed to dismiss', toError(error));
      return false;
    }

    logger.info('[Realtime Alert] Alert dismissed', { alertId, userId });
    return true;
  } catch (error) {
    logger.error('[Realtime Alert] Error dismissing alert', toError(error));
    return false;
  }
}

/**
 * Clean up expired alerts (cron job).
 * Removes alerts where expires_at < NOW() or created_at > 30 days ago.
 * Returns number of deleted alerts.
 */
export async function cleanupExpiredAlerts(): Promise<number> {
  try {
    const db = createServerClient();

    // Use computed Unix timestamps — D1 .or() parser passes values as bound params,
    // so PostgREST literals like `now()` won't be evaluated (silent no-match risk).
    const nowSec = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = nowSec - 30 * 24 * 60 * 60;
    const { count, error } = await db
      .from('user_alerts')
      .delete()
      .or(`expires_at.lt.${nowSec},created_at.lt.${thirtyDaysAgo}`);

    if (error) {
      logger.error('[Realtime Alert] Cleanup failed', toError(error));
      return 0;
    }

    logger.info('[Realtime Alert] Cleaned up expired alerts', { count });
    return count || 0;
  } catch (error) {
    logger.error('[Realtime Alert] Error during cleanup', toError(error));
    return 0;
  }
}

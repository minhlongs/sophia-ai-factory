import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { UserAlert, UnreadAlertCount } from './realtime-alert-types';

/** Get unread alerts for user. Returns array of unread alerts. */
export async function getUnreadAlerts(
  userId: string,
  limit: number = 20
): Promise<UserAlert[]> {
  try {
    const db = createServerClient();

    const { data, error } = await db
      .from('user_alerts')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('[Realtime Alert] Failed to fetch unread', toError(error));
      return [];
    }

    return (data || []) as unknown as UserAlert[];
  } catch (error) {
    logger.error('[Realtime Alert] Error fetching unread', toError(error));
    return [];
  }
}

/** Get alert history for user (includes read and dismissed). */
export async function getAlertHistory(
  userId: string,
  licenseNonce?: string,
  limit: number = 50
): Promise<UserAlert[]> {
  try {
    const db = createServerClient();

    let query = db
      .from('user_alerts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (licenseNonce) {
      query = query.eq('license_nonce', licenseNonce);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('[Realtime Alert] Failed to fetch history', toError(error));
      return [];
    }

    return (data || []) as unknown as UserAlert[];
  } catch (error) {
    logger.error('[Realtime Alert] Error fetching history', toError(error));
    return [];
  }
}

/** Get unread alert count breakdown by severity. */
export async function getUnreadCount(
  userId: string
): Promise<UnreadAlertCount> {
  try {
    const db = createServerClient();

    const { data, error } = await db
      .from('user_alerts')
      .select('severity')
      .eq('user_id', userId)
      .eq('read', false)
      .eq('dismissed', false);

    if (error) {
      logger.error('[Realtime Alert] Failed to count', toError(error));
      return { total: 0, critical: 0, high: 0 };
    }

    const result: UnreadAlertCount = { total: 0, critical: 0, high: 0 };

    for (const alert of data || []) {
      result.total++;
      if (alert.severity === 'critical') result.critical++;
      if (alert.severity === 'high') result.high++;
    }

    return result;
  } catch (error) {
    logger.error('[Realtime Alert] Error counting', toError(error));
    return { total: 0, critical: 0, high: 0 };
  }
}

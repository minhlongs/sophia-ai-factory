import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { CreateAlertParams } from './realtime-alert-types';

export { dismissAlert, cleanupExpiredAlerts } from './realtime-alert-lifecycle';

/** Create real-time alert for user. Returns alert ID or null on failure. */
export async function createRealtimeAlert(
  params: CreateAlertParams
): Promise<string | null> {
  try {
    const db = createServerClient();

    const { data: rawData, error } = await db
      .from('user_alerts')
      .insert({
        user_id: params.userId,
        license_nonce: params.licenseNonce,
        type: params.type,
        severity: params.severity,
        title: params.title,
        message: params.message,
        metadata: params.metadata || {},
        ip_address: params.ipAddress,
        endpoint: params.endpoint,
        pushed: false,
        expires_at: params.expiresAt?.toISOString() || null,
      })
      .select('id')
      .single();
    const data = rawData as { id: string } | null;

    if (error || !data) {
      logger.error('[Realtime Alert] Failed to create alert', toError(error));
      return null;
    }

    logger.info('[Realtime Alert] Alert created', {
      alertId: data.id,
      userId: params.userId,
      type: params.type,
      severity: params.severity,
    });

    return data.id;
  } catch (error) {
    logger.error('[Realtime Alert] Error creating alert', toError(error));
    return null;
  }
}

/** Mark alert as read. Returns true if successful. */
export async function markAlertAsRead(
  alertId: string,
  userId: string
): Promise<boolean> {
  try {
    const db = createServerClient();

    const { error } = await db
      .from('user_alerts')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', alertId)
      .eq('user_id', userId);

    if (error) {
      logger.error('[Realtime Alert] Failed to mark as read', toError(error));
      return false;
    }

    logger.info('[Realtime Alert] Alert marked as read', { alertId, userId });
    return true;
  } catch (error) {
    logger.error('[Realtime Alert] Error marking as read', toError(error));
    return false;
  }
}

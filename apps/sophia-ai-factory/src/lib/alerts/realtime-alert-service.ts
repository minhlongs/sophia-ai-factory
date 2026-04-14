/**
 * Real-time Alert Service
 *
 * Push real-time alerts to AgencyOS dashboard via WebSocket/pub-sub.
 * Supports: usage_threshold, license_expiring, webhook_delivery_failed, quota_exceeded
 *
 * Features:
 * - Create alerts with severity levels
 * - Track read/unread status
 * - Track dismissal
 * - Auto-expiry for old alerts
 * - Integration with violations table for audit trail
 *
 * @module alerts/realtime-alert-service
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import type { Tier } from '@/types';

/**
 * Alert types
 */
export type AlertType =
  | 'usage_threshold'
  | 'license_expiring'
  | 'webhook_delivery_failed'
  | 'quota_exceeded'
  | 'payment_failed'
  | 'subscription_cancelled';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Real-time alert creation params
 */
export interface CreateAlertParams {
  userId: string;
  licenseNonce: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  endpoint?: string;
  expiresAt?: Date;
}

/**
 * Alert record for dashboard
 */
export interface UserAlert {
  id: string;
  userId: string;
  licenseNonce: string | null;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata: Record<string, any> | null;
  pushed: boolean;
  pushedAt: string | null;
  read: boolean;
  readAt: string | null;
  dismissed: boolean;
  dismissedAt: string | null;
  createdAt: string;
  expiresAt: string | null;
}

/**
 * Unread alert count result
 */
export interface UnreadAlertCount {
  total: number;
  critical: number;
  high: number;
}

/**
 * Create real-time alert for user
 *
 * @param params - Alert creation parameters
 * @returns Created alert ID or null on failure
 */
export async function createRealtimeAlert(
  params: CreateAlertParams
): Promise<string | null> {
  try {
    const db = createServerClient();

    const { data, error } = await db
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

    if (error || !data) {
      logger.error('[Realtime Alert] Failed to create alert', error as Error);
      return null;
    }

    logger.info('[Realtime Alert] Alert created', {
      alertId: data.id,
      userId: params.userId,
      type: params.type,
      severity: params.severity,
    });

    // Note: WebSocket push would be triggered here
    // In production: await websocketServer.push('alert:new', { userId: params.userId, alertId: data.id });

    return data.id;
  } catch (error) {
    logger.error('[Realtime Alert] Error creating alert', error as Error);
    return null;
  }
}

/**
 * Mark alert as read
 *
 * @param alertId - Alert ID
 * @param userId - User ID (for authorization)
 * @returns true if successful
 */
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
      logger.error('[Realtime Alert] Failed to mark as read', error);
      return false;
    }

    logger.info('[Realtime Alert] Alert marked as read', { alertId, userId });
    return true;
  } catch (error) {
    logger.error('[Realtime Alert] Error marking as read', error as Error);
    return false;
  }
}

/**
 * Dismiss alert (hide from dashboard)
 *
 * @param alertId - Alert ID
 * @param userId - User ID (for authorization)
 * @returns true if successful
 */
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
      logger.error('[Realtime Alert] Failed to dismiss', error);
      return false;
    }

    logger.info('[Realtime Alert] Alert dismissed', { alertId, userId });
    return true;
  } catch (error) {
    logger.error('[Realtime Alert] Error dismissing alert', error as Error);
    return false;
  }
}

/**
 * Get unread alerts for user
 *
 * @param userId - User ID
 * @param limit - Max results (default: 20)
 * @returns Array of unread alerts
 */
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
      logger.error('[Realtime Alert] Failed to fetch unread', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('[Realtime Alert] Error fetching unread', error as Error);
    return [];
  }
}

/**
 * Get alert history for user (includes read and dismissed)
 *
 * @param userId - User ID
 * @param licenseNonce - Optional license filter
 * @param limit - Max results (default: 50)
 * @returns Array of alerts
 */
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
      logger.error('[Realtime Alert] Failed to fetch history', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('[Realtime Alert] Error fetching history', error as Error);
    return [];
  }
}

/**
 * Get unread alert count by severity
 *
 * @param userId - User ID
 * @returns Count breakdown
 */
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
      logger.error('[Realtime Alert] Failed to count', error);
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
    logger.error('[Realtime Alert] Error counting', error as Error);
    return { total: 0, critical: 0, high: 0 };
  }
}

/**
 * Trigger usage threshold alert
 *
 * @param params - Alert parameters
 * @returns Alert ID or null
 */
export async function triggerUsageThresholdAlert(params: {
  userId: string;
  licenseNonce: string;
  tier: Tier;
  threshold: number;
  percentage: number;
  limit: number;
  currentUsage: number;
  exceededType: string;
  ipAddress?: string;
}): Promise<string | null> {
  const severity: AlertSeverity =
    params.threshold === 100 ? 'critical' :
    params.threshold >= 90 ? 'high' :
    params.threshold >= 80 ? 'medium' : 'low';

  const title = params.threshold === 100
    ? 'Service Restricted - Quota Exceeded'
    : params.threshold >= 90
    ? 'Urgent: Approaching Usage Limit'
    : 'Usage Alert';

  const message = `Your ${params.tier} plan usage has reached ${params.percentage.toFixed(0)}% of ${params.exceededType.replace('_', ' ')} limit.`;

  return createRealtimeAlert({
    userId: params.userId,
    licenseNonce: params.licenseNonce,
    type: 'usage_threshold',
    severity,
    title,
    message,
    metadata: {
      threshold: params.threshold,
      percentage: params.percentage,
      limit: params.limit,
      currentUsage: params.currentUsage,
      tier: params.tier,
      exceededType: params.exceededType,
    },
    ipAddress: params.ipAddress,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });
}

/**
 * Trigger license expiration warning
 *
 * @param params - Alert parameters
 * @returns Alert ID or null
 */
export async function triggerLicenseExpiringAlert(params: {
  userId: string;
  licenseNonce: string;
  daysRemaining: number;
  tier: Tier;
}): Promise<string | null> {
  const severity: AlertSeverity =
    params.daysRemaining <= 3 ? 'critical' :
    params.daysRemaining <= 7 ? 'high' : 'medium';

  return createRealtimeAlert({
    userId: params.userId,
    licenseNonce: params.licenseNonce,
    type: 'license_expiring',
    severity,
    title: `License Expiring in ${params.daysRemaining} Days`,
    message: `Your ${params.tier} license will expire in ${params.daysRemaining} days. Renew to continue service.`,
    metadata: {
      daysRemaining: params.daysRemaining,
      tier: params.tier,
    },
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  });
}

/**
 * Trigger webhook delivery failure alert
 *
 * @param params - Alert parameters
 * @returns Alert ID or null
 */
export async function triggerWebhookFailedAlert(params: {
  userId: string;
  licenseNonce: string;
  webhookUrl: string;
  attempts: number;
  error: string;
}): Promise<string | null> {
  return createRealtimeAlert({
    userId: params.userId,
    licenseNonce: params.licenseNonce,
    type: 'webhook_delivery_failed',
    severity: 'high',
    title: 'Webhook Delivery Failed',
    message: `Failed to deliver webhook to ${params.webhookUrl} after ${params.attempts} attempts.`,
    metadata: {
      webhookUrl: params.webhookUrl,
      attempts: params.attempts,
      error: params.error,
    },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

/**
 * Log violation and create alert (combined operation)
 *
 * @param params - Violation and alert params
 * @returns { violationId, alertId }
 */
export async function logViolationAndAlert(params: {
  userId: string;
  licenseNonce: string;
  tier: Tier;
  type: 'quota_exceeded' | 'rate_limit_exceeded' | 'unauthorized_access';
  severity: AlertSeverity;
  endpoint: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}): Promise<{ violationId: string | null; alertId: string | null }> {
  const db = createServerClient();

  // Insert violation
  const violationId = await (async () => {
    try {
      const { data, error } = await db
        .from('violations')
        .insert({
          type: params.type,
          severity: params.severity,
          user_id: params.userId,
          license_nonce: params.licenseNonce,
          tier: params.tier,
          endpoint: params.endpoint,
          ip_address: params.ipAddress,
          user_agent: params.userAgent,
          metadata: params.metadata || {},
        })
        .select('id')
        .single();

      return data?.id || null;
    } catch (error) {
      logger.error('[Realtime Alert] Failed to log violation', error as Error);
      return null;
    }
  })();

  // Create alert
  const alertId = await createRealtimeAlert({
    userId: params.userId,
    licenseNonce: params.licenseNonce,
    type: params.type === 'quota_exceeded' ? 'quota_exceeded' : 'usage_threshold',
    severity: params.severity,
    title: params.type === 'quota_exceeded' ? 'Quota Exceeded' : 'Access Violation',
    message: `Violation detected: ${params.type} at ${params.endpoint}`,
    metadata: {
      violationId,
      ...params.metadata,
    },
    ipAddress: params.ipAddress,
    endpoint: params.endpoint,
  });

  return { violationId, alertId };
}

/**
 * Clean up expired alerts (cron job)
 * Run daily to remove alerts older than 30 days
 *
 * @returns Number of deleted alerts
 */
export async function cleanupExpiredAlerts(): Promise<number> {
  try {
    const db = createServerClient();

    // Delete alerts where expires_at < NOW() OR created_at > 30 days ago
    const { count, error } = await db
      .from('user_alerts')
      .delete()
      .or('expires_at.lt.now(),created_at.lt.now() - interval \'30 days\'');

    if (error) {
      logger.error('[Realtime Alert] Cleanup failed', error);
      return 0;
    }

    logger.info('[Realtime Alert] Cleaned up expired alerts', { count });
    return count || 0;
  } catch (error) {
    logger.error('[Realtime Alert] Error during cleanup', error as Error);
    return 0;
  }
}

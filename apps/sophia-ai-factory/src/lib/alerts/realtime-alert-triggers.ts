import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';
import type { Tier } from '@/types';
import type { AlertSeverity } from './realtime-alert-types';
import { createRealtimeAlert } from './realtime-alert-mutations';

/** Trigger usage threshold alert. Returns alert ID or null. */
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
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

/** Trigger license expiration warning. Returns alert ID or null. */
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
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });
}

/** Trigger webhook delivery failure alert. Returns alert ID or null. */
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

/** Log violation record and create alert in a single operation. */
export async function logViolationAndAlert(params: {
  userId: string;
  licenseNonce: string;
  tier: Tier;
  type: 'quota_exceeded' | 'rate_limit_exceeded' | 'unauthorized_access';
  severity: AlertSeverity;
  endpoint: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ violationId: string | null; alertId: string | null }> {
  const db = createServerClient();

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
      logger.error('[Realtime Alert] Failed to log violation', toError(error));
      return null;
    }
  })();

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

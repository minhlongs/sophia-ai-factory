import type { Tier } from '@/seed/types';
import type { AlertSeverity } from './realtime-alert-types';
import { createRealtimeAlert } from './realtime-alert-mutations';

export { logViolationAndAlert } from './realtime-violation-alert-logger';

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

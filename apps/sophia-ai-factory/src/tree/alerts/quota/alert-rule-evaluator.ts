/**
 * Alert Rule Evaluator
 *
 * Evaluates quota thresholds, builds alert templates, and checks rate limits.
 * Determines which alerts to fire based on current usage percentages.
 *
 * @module alerts/quota/alert-rule-evaluator
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  buildEmailHtml80,
  buildEmailHtml90,
  buildEmailHtml100,
} from './alert-email-templates';
import {
  type AlertSeverity,
  type AlertChannel,
  type AlertThreshold,
  type QuotaAlertContext,
  type AlertTemplate,
  type AlertConfig,
  type AlertDeliveryResult,
  TIER_ALERT_CONFIGS,
} from './alert-rule-types';

export type {
  AlertSeverity,
  AlertChannel,
  AlertThreshold,
  QuotaAlertContext,
  AlertTemplate,
  AlertConfig,
  AlertDeliveryResult,
};
export { TIER_ALERT_CONFIGS };

/**
 * Get alert template for a given threshold and channel
 */
export function getAlertTemplate(context: QuotaAlertContext, channel: AlertChannel): AlertTemplate {
  const { threshold, percentage, limit, currentUsage } = context;
  const tierDisplay = context.tier.charAt(0) + context.tier.slice(1).toLowerCase();
  const usageType = context.exceededType.replace('_', ' ');
  const billingUrl = '/dashboard/billing';
  const upgradeUrl = '/dashboard/billing?action=upgrade';

  if (channel === 'email') {
    if (threshold === 80) {
      return {
        subject: `[Sophia AI] Usage Alert: ${percentage.toFixed(0)}% of ${tierDisplay} plan used`,
        body: `Hi there,\n\nYour Sophia AI usage has reached ${percentage.toFixed(0)}% of your ${tierDisplay} plan limit.\n\nUsage: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()}\n\nView dashboard: ${billingUrl}`,
        htmlBody: buildEmailHtml80(context),
      };
    } else if (threshold === 90) {
      return {
        subject: `[Sophia AI] URGENT: ${percentage.toFixed(0)}% of ${tierDisplay} plan used - Action Required`,
        body: `Hi there,\n\nURGENT: ${percentage.toFixed(0)}% of your ${tierDisplay} plan used.\n\n${usageType}: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()}\n\nUpgrade now: ${upgradeUrl}`,
        htmlBody: buildEmailHtml90(context),
      };
    } else {
      return {
        subject: `[Sophia AI] CRITICAL: Service Restricted - ${tierDisplay} Plan Limit Exceeded`,
        body: `CRITICAL: Your ${tierDisplay} plan limit has been reached.\n\n${usageType}: ${currentUsage.toLocaleString()} / ${limit.toLocaleString()}\n\nUpgrade now: ${upgradeUrl}\nContact support: support@mekongmind.com`,
        htmlBody: buildEmailHtml100(),
      };
    }
  }

  // SMS templates
  if (threshold === 80) {
    return { subject: '', body: '', smsBody: `Sophia AI Alert: You've used ${percentage.toFixed(0)}% of your ${tierDisplay} plan. Monitor: ${billingUrl}` };
  } else if (threshold === 90) {
    return { subject: '', body: '', smsBody: `URGENT: ${percentage.toFixed(0)}% of Sophia AI plan used. Upgrade to avoid restriction: ${upgradeUrl}` };
  } else {
    return { subject: '', body: '', smsBody: `CRITICAL: Sophia AI service restricted. Upgrade to restore: ${upgradeUrl}` };
  }
}

/**
 * Check if an alert is rate-limited (true = suppress alert)
 */
export async function isRateLimited(
  userId: string,
  threshold: AlertThreshold,
  config: AlertConfig
): Promise<boolean> {
  try {
    const db = createServerClient();
    const windowStart = Date.now() - (config.rateLimitWindowSeconds * 1000);

    const { data: recentAlerts } = await db
      .from('quota_alerts')
      .select('id')
      .eq('user_id', userId)
      .eq('threshold', threshold)
      .gte('sent_at', new Date(windowStart).toISOString())
      .limit(1);

    return (recentAlerts?.length ?? 0) > 0;
  } catch (error) {
    logger.error('[Quota Alert] Error checking rate limit', toError(error));
    return false; // Fail-open
  }
}

/**
 * Determine which alert thresholds to trigger for a given usage percentage
 */
export function determineThresholdsToTrigger(percentage: number): AlertThreshold[] {
  if (percentage >= 100) return [100, 90, 80];
  if (percentage >= 90) return [90, 80];
  if (percentage >= 80) return [80];
  return [];
}

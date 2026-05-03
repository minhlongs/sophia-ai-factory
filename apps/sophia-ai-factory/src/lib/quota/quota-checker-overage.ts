import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { triggerUsageThresholdAlert } from '@/lib/alerts/realtime-alert-service';
import type { QuotaLimit } from '@/lib/usage-metering/types';
import type { QuotaCheckContext, QuotaConfig, CachedQuota } from './quota-checker-types';
import { DEFAULT_CONFIG } from './quota-checker-types';
import { getEffectiveQuotaLimits, calculateCurrentUsage } from './quota-checker-db';

/**
 * Log overage event for billing reconciliation.
 * Phase 7.3: Also triggers real-time alert when threshold breached.
 */
export async function logOverageEvent(
  context: QuotaCheckContext & {
    exceededType: string;
    exceededLimit: number;
    exceededCurrent: number;
    exceededBy: number;
  },
  config: QuotaConfig = DEFAULT_CONFIG
): Promise<string | null> {
  try {
    const db = createServerClient();
    const { data, error } = await db
      .from('overage_events')
      .insert({
        user_id: context.userId,
        license_nonce: context.licenseNonce,
        exceeded_type: context.exceededType,
        exceeded_limit: context.exceededLimit,
        exceeded_current: context.exceededCurrent,
        exceeded_by: context.exceededBy,
        requested_credits: context.requestedCredits,
        endpoint: context.endpoint,
        service_name: context.service,
        action: context.action,
        tier_at_exceeded: context.tier,
        billable: config.enableOverageBilling,
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
      })
      .select('id')
      .single();

    if (error) throw error;

    logger.warn('[Quota Checker] Overage event logged', {
      eventId: data?.id,
      userId: context.userId,
      licenseNonce: context.licenseNonce.slice(0, 8) + '...',
      exceededType: context.exceededType,
      exceededBy: context.exceededBy,
      billable: config.enableOverageBilling,
    });

    const thresholdMap: Record<string, number> = {
      hourly_credits: 80,
      daily_credits: 80,
      monthly_credits: 80,
    };

    const baseThreshold = thresholdMap[context.exceededType] || 80;
    const percentage = (context.exceededCurrent / context.exceededLimit) * 100;

    if (percentage >= baseThreshold) {
      await triggerUsageThresholdAlert({
        userId: context.userId,
        licenseNonce: context.licenseNonce,
        tier: context.tier as Parameters<typeof triggerUsageThresholdAlert>[0]['tier'],
        threshold: percentage >= 100 ? 100 : percentage >= 90 ? 90 : 80,
        percentage,
        limit: context.exceededLimit,
        currentUsage: context.exceededCurrent,
        exceededType: context.exceededType,
        ipAddress: context.ipAddress,
      }).catch(err => {
        logger.error('[Quota Checker] Failed to trigger real-time alert', toError(err));
      });
    }

    return (data as { id?: string } | null)?.id ?? null;
  } catch (error) {
    logger.error('[Quota Checker] Failed to log overage event', toError(error));
    return null;
  }
}

/** Get quota status for dashboard display. Returns full quota breakdown with percentages. */
export async function getQuotaStatus(
  userId: string,
  licenseNonce: string,
  tier: string
): Promise<{
  usage: CachedQuota;
  limits: QuotaLimit;
  percentages: { hourly: number; daily: number; monthly: number };
  status: 'ok' | 'warning' | 'critical';
}> {
  const limits = await getEffectiveQuotaLimits(licenseNonce, tier);
  const usage = await calculateCurrentUsage(userId, licenseNonce);

  const percentages = {
    hourly: (usage.hourly / limits.hourlyCredits) * 100,
    daily: (usage.daily / limits.dailyCredits) * 100,
    monthly: (usage.monthly / limits.monthlyCredits) * 100,
  };

  const maxPercent = Math.max(percentages.hourly, percentages.daily, percentages.monthly);
  const status: 'ok' | 'warning' | 'critical' =
    maxPercent >= 100 ? 'critical' :
    maxPercent >= 80 ? 'warning' : 'ok';

  return { usage, limits, percentages, status };
}

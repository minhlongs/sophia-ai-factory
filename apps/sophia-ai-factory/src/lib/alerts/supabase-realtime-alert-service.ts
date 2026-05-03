/**
 * Alert Service — polling-based replacement for Supabase Realtime
 *
 * Replaces Supabase Realtime subscriptions with interval polling via D1.
 * Monitors usage_events for threshold breaches (80%, 90%, 100%).
 *
 * @module alerts/supabase-realtime-alert-service
 */

import { getD1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { triggerUsageThresholdAlert } from '@/lib/alerts/realtime-alert-service';
import {
  checkThresholds,
  isDebounced,
  markAlertSent,
  getQuotaLimitForTier,
} from './alert-threshold-utils';

/** Configuration for alert polling */
export interface RealtimeAlertConfig {
  supabaseUrl: string;   // kept for interface compat — unused
  supabaseKey: string;   // kept for interface compat — unused
  debounceMs: number;
  enabledThresholds: number[];
}

const DEFAULT_CONFIG: RealtimeAlertConfig = {
  supabaseUrl: '',
  supabaseKey: '',
  debounceMs: 60000,
  enabledThresholds: [80, 90, 100],
};

interface UsageEventRecord {
  id: string;
  user_id: string;
  license_nonce: string;
  credits_used: number;
  endpoint: string;
  service_name?: string;
  created_at: string;
  tenant_id?: string;
}

async function handleUsageEvent(
  payload: UsageEventRecord,
  config: RealtimeAlertConfig
): Promise<void> {
  try {
    const { user_id, license_nonce } = payload;
    const db = await getD1Client();

    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);

    const { data: usageEvents } = await db
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', user_id)
      .eq('license_nonce', license_nonce)
      .gte('created_at', hourStart.toISOString());

    const currentUsage = ((usageEvents as { credits_used: number }[] | null) || [])
      .reduce((sum, e) => sum + (e.credits_used || 0), 0);

    const { data: license } = await db
      .from('raas_licenses')
      .select('tier')
      .eq('nonce', license_nonce)
      .single();

    if (!license) {
      logger.warn('[Alert] License not found', { userId: user_id });
      return;
    }

    const licenseRecord = license as { tier: string };
    const limits = getQuotaLimitForTier(licenseRecord.tier);
    const thresholdCheck = checkThresholds(currentUsage, limits.hourly, config.enabledThresholds);

    if (!thresholdCheck.breached) return;

    if (isDebounced(user_id, license_nonce, thresholdCheck.threshold, config.debounceMs)) return;

    const alertId = await triggerUsageThresholdAlert({
      userId: user_id,
      licenseNonce: license_nonce,
      tier: licenseRecord.tier as Parameters<typeof triggerUsageThresholdAlert>[0]['tier'],
      threshold: thresholdCheck.threshold,
      percentage: thresholdCheck.percentage,
      limit: limits.hourly,
      currentUsage,
      exceededType: 'hourly_credits',
      ipAddress: undefined,
    });

    if (alertId) {
      markAlertSent(user_id, license_nonce, thresholdCheck.threshold);
      logger.info('[Alert] Threshold alert triggered', {
        userId: user_id,
        threshold: thresholdCheck.threshold,
        alertId,
      });
    }
  } catch (error) {
    logger.error('[Alert] Error handling usage event', toError(error));
  }
}

/**
 * Poll usage_events for new records and process threshold alerts.
 * Replaces Supabase Realtime subscription.
 *
 * @returns Unsubscribe/stop function
 */
export async function subscribeToUsageEvents(
  config: RealtimeAlertConfig = DEFAULT_CONFIG
): Promise<() => Promise<void>> {
  let lastChecked = new Date().toISOString();
  let stopped = false;

  const poll = async () => {
    if (stopped) return;
    try {
      const db = await getD1Client();
      const { data: events } = await db
        .from('usage_events')
        .select('*')
        .gte('created_at', lastChecked);

      const records = (events as UsageEventRecord[] | null) || [];
      if (records.length > 0) {
        lastChecked = new Date().toISOString();
        for (const event of records) {
          await handleUsageEvent(event, config);
        }
      }
    } catch (error) {
      logger.error('[Alert] Poll error', toError(error));
    }
  };

  const intervalId = setInterval(poll, 30000);
  logger.info('[Alert] Polling usage_events for threshold alerts (30s interval)');

  return async () => {
    stopped = true;
    clearInterval(intervalId);
    logger.info('[Alert] Stopped usage_events polling');
  };
}

/**
 * Poll violations table for new records (logging only — no-op for alerts).
 *
 * @returns Unsubscribe/stop function
 */
export async function subscribeToViolations(
  config: RealtimeAlertConfig = DEFAULT_CONFIG
): Promise<() => Promise<void>> {
  let lastChecked = new Date().toISOString();
  let stopped = false;

  const poll = async () => {
    if (stopped) return;
    try {
      const db = await getD1Client();
      const { data: violations } = await db
        .from('violations')
        .select('user_id, type, severity')
        .gte('created_at', lastChecked);

      const records = (violations as { user_id: string; type: string; severity: string }[] | null) || [];
      if (records.length > 0) {
        lastChecked = new Date().toISOString();
        for (const v of records) {
          logger.info('[Alert] Violation detected', { userId: v.user_id, type: v.type, severity: v.severity });
        }
      }
    } catch (error) {
      logger.error('[Alert] Violations poll error', toError(error));
    }
  };

  const intervalId = setInterval(poll, 30000);

  return async () => {
    stopped = true;
    clearInterval(intervalId);
  };
}

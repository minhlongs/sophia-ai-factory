/**
 * Supabase Realtime Alert Service
 *
 * Subscribe to usage_events table changes and trigger real-time alerts:
 * - Monitor usage threshold breaches (80%, 90%, 100%)
 * - Detect license violations
 * - Dispatch webhook notifications to AgencyOS dashboard
 * - Log alerts with audit trail
 *
 * Features:
 * - Supabase Realtime subscriptions
 * - Debounced alert triggering (prevent spam)
 * - Multi-tenant isolation
 * - Integration with realtime-alert-service
 *
 * @module alerts/supabase-realtime-alert-service
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger-utility';
import { triggerUsageThresholdAlert } from '@/lib/alerts/realtime-alert-service';

/**
 * Realtime subscription configuration
 */
export interface RealtimeAlertConfig {
  supabaseUrl: string;
  supabaseKey: string;
  debounceMs: number;          // Debounce alerts (default: 60000 = 1 min)
  enabledThresholds: number[]; // [80, 90, 100]
}

const DEFAULT_CONFIG: RealtimeAlertConfig = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  debounceMs: 60000,
  enabledThresholds: [80, 90, 100],
};

/**
 * Usage event payload from Supabase Realtime
 */
interface UsageEventPayload {
  id: string;
  user_id: string;
  license_nonce: string;
  credits_used: number;
  endpoint: string;
  service_name?: string;
  action?: string;
  created_at: string;
  tenant_id?: string;
}

/**
 * Alert debounce state
 */
interface DebounceState {
  lastAlertTime: Map<string, number>; // key: userId:licenseNonce:threshold
}

const debounceState: DebounceState = {
  lastAlertTime: new Map(),
};

/**
 * Calculate usage percentage and check thresholds
 */
function checkThresholds(
  currentUsage: number,
  limit: number,
  thresholds: number[]
): { breached: boolean; threshold: number; percentage: number } {
  const percentage = (currentUsage / limit) * 100;

  // Find highest breached threshold
  for (const threshold of thresholds.sort((a, b) => b - a)) {
    if (percentage >= threshold) {
      return {
        breached: true,
        threshold,
        percentage,
      };
    }
  }

  return {
    breached: false,
    threshold: 0,
    percentage,
  };
}

/**
 * Check if alert is debounced (prevent spam)
 */
function isDebounced(
  userId: string,
  licenseNonce: string,
  threshold: number,
  debounceMs: number
): boolean {
  const key = `${userId}:${licenseNonce}:${threshold}`;
  const lastTime = debounceState.lastAlertTime.get(key);

  if (!lastTime) return false;

  const now = Date.now();
  return (now - lastTime) < debounceMs;
}

/**
 * Update debounce timestamp
 */
function markAlertSent(
  userId: string,
  licenseNonce: string,
  threshold: number
): void {
  const key = `${userId}:${licenseNonce}:${threshold}`;
  debounceState.lastAlertTime.set(key, Date.now());
}

/**
 * Get quota limit for tier
 */
function getQuotaLimitForTier(tier: string): { hourly: number; daily: number; monthly: number } {
  const limits: Record<string, { hourly: number; daily: number; monthly: number }> = {
    BASIC: { hourly: 100, daily: 1000, monthly: 10000 },
    PREMIUM: { hourly: 500, daily: 5000, monthly: 50000 },
    ENTERPRISE: { hourly: 2000, daily: 20000, monthly: 200000 },
    MASTER: { hourly: 10000, daily: 100000, monthly: 1000000 },
  };

  return limits[tier.toUpperCase()] || limits.BASIC;
}

/**
 * Handle usage event from Supabase Realtime
 */
async function handleUsageEvent(
  payload: UsageEventPayload,
  config: RealtimeAlertConfig
): Promise<void> {
  try {
    const { user_id, license_nonce, credits_used, created_at } = payload;

    // Fetch current aggregated usage from DB
    const supabase = createClient(config.supabaseUrl, config.supabaseKey);

    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);

    // Get current hour usage
    const { data: usageEvents } = await supabase
      .from('usage_events')
      .select('credits_used')
      .eq('user_id', user_id)
      .eq('license_nonce', license_nonce)
      .gte('created_at', hourStart.toISOString());

    const currentUsage = (usageEvents || []).reduce((sum, e) => sum + (e.credits_used || 0), 0);

    // Get license tier
    const { data: license } = await supabase
      .from('raas_licenses')
      .select('tier')
      .eq('nonce', license_nonce)
      .single();

    if (!license) {
      logger.warn('[Realtime Alert] License not found', {
        userId: user_id,
        licenseNonce: license_nonce.slice(0, 8) + '...',
      });
      return;
    }

    // Check thresholds
    const limits = getQuotaLimitForTier(license.tier);
    const thresholdCheck = checkThresholds(currentUsage, limits.hourly, config.enabledThresholds);

    if (!thresholdCheck.breached) {
      return;
    }

    // Check debounce
    if (isDebounced(user_id, license_nonce, thresholdCheck.threshold, config.debounceMs)) {
      logger.debug('[Realtime Alert] Alert debounced', {
        userId: user_id,
        licenseNonce: license_nonce.slice(0, 8) + '...',
        threshold: thresholdCheck.threshold,
      });
      return;
    }

    // Trigger real-time alert
    const alertId = await triggerUsageThresholdAlert({
      userId: user_id,
      licenseNonce: license_nonce,
      tier: license.tier as any,
      threshold: thresholdCheck.threshold,
      percentage: thresholdCheck.percentage,
      limit: limits.hourly,
      currentUsage,
      exceededType: 'hourly_credits',
      ipAddress: undefined,
    });

    if (alertId) {
      markAlertSent(user_id, license_nonce, thresholdCheck.threshold);

      logger.info('[Realtime Alert] Alert triggered via Realtime', {
        userId: user_id,
        licenseNonce: license_nonce.slice(0, 8) + '...',
        threshold: thresholdCheck.threshold,
        percentage: thresholdCheck.percentage,
        alertId,
      });
    }
  } catch (error) {
    logger.error('[Realtime Alert] Error handling usage event', error as Error);
  }
}

/**
 * Subscribe to usage events with Supabase Realtime
 *
 * @param config - Realtime configuration
 * @returns Unsubscribe function
 */
export async function subscribeToUsageEvents(
  config: RealtimeAlertConfig = DEFAULT_CONFIG
): Promise<() => Promise<void>> {
  if (!config.supabaseUrl || !config.supabaseKey) {
    logger.warn('[Realtime Alert] Supabase credentials not configured, skipping realtime subscription');
    return async () => {};
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  try {
    // Subscribe to usage_events table
    const channel = supabase
      .channel('usage_events_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'usage_events',
        },
        async (payload) => {
          const newRecord = payload.new as unknown as UsageEventPayload;
          await handleUsageEvent(newRecord, config);
        }
      )
      .subscribe();

    // Wait for subscription to establish
    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('[Realtime Alert] Subscribed to usage_events table');
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('[Realtime Alert] Subscription error', { status });
          resolve();
        }
      });
    });

    // Return unsubscribe function
    return async () => {
      await supabase.removeChannel(channel);
      logger.info('[Realtime Alert] Unsubscribed from usage_events');
    };
  } catch (error) {
    logger.error('[Realtime Alert] Failed to subscribe', error as Error);
    return async () => {};
  }
}

/**
 * Subscribe to license violations with Supabase Realtime
 *
 * @param config - Realtime configuration
 * @returns Unsubscribe function
 */
export async function subscribeToViolations(
  config: RealtimeAlertConfig = DEFAULT_CONFIG
): Promise<() => Promise<void>> {
  if (!config.supabaseUrl || !config.supabaseKey) {
    return async () => {};
  }

  const supabase = createClient(config.supabaseUrl, config.supabaseKey);

  try {
    const channel = supabase
      .channel('violations_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'violations',
        },
        async (payload) => {
          const newRecord = payload.new as any;
          logger.info('[Realtime Alert] Violation detected', {
            userId: newRecord.user_id,
            type: newRecord.type,
            severity: newRecord.severity,
          });
          // Violation alerts are already logged in raas-gate.ts via logViolationAndAlert
        }
      )
      .subscribe();

    await new Promise<void>((resolve) => {
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          logger.info('[Realtime Alert] Subscribed to violations table');
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          logger.error('[Realtime Alert] Violation subscription error', { status });
          resolve();
        }
      });
    });

    return async () => {
      await supabase.removeChannel(channel);
    };
  } catch (error) {
    logger.error('[Realtime Alert] Failed to subscribe to violations', error as Error);
    return async () => {};
  }
}

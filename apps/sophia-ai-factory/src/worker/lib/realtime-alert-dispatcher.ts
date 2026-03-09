/**
 * RaaS Gateway Worker - Realtime Alert Dispatcher
 *
 * Cloudflare Worker that:
 * - Monitors usage_events via Supabase Realtime
 * - Detects threshold breaches (80%, 90%, 100%)
 * - Dispatches webhook alerts to AgencyOS dashboard
 * - Respects KV-based rate limiting
 * - Authenticated via JWT/mk_ API key
 *
 * @module worker/realtime-alert-dispatcher
 */

import { ExecutionContext } from '@cloudflare/workers-types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger-utility';

/**
 * Alert dispatcher configuration
 */
export interface AlertDispatcherConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  agencyosWebhookUrl: string;
  agencyosApiKey: string;
  debounceMs: number;
  enabledThresholds: number[];
}

/**
 * Usage event from Supabase Realtime
 */
interface UsageEvent {
  id: string;
  user_id: string;
  license_nonce: string;
  credits_used: number;
  endpoint: string;
  service_name?: string;
  created_at: string;
  tenant_id?: string;
}

/**
 * Alert payload for AgencyOS dashboard
 */
interface AgencyOSAlertPayload {
  eventId: string;
  type: 'usage_threshold' | 'license_violation' | 'quota_exceeded';
  severity: 'low' | 'medium' | 'high' | 'critical';
  tenantId: string;
  licenseNonce: string;
  threshold?: number;
  percentage: number;
  limit: number;
  currentUsage: number;
  timestamp: string;
  metadata: Record<string, any>;
}

/**
 * Debounce state stored in KV
 */
interface DebounceState {
  lastAlertTime: number;
  threshold: number;
}

/**
 * Get quota limits by tier
 */
function getQuotaLimits(tier: string): { hourly: number; daily: number; monthly: number } {
  const limits: Record<string, { hourly: number; daily: number; monthly: number }> = {
    BASIC: { hourly: 100, daily: 1000, monthly: 10000 },
    PREMIUM: { hourly: 500, daily: 5000, monthly: 50000 },
    ENTERPRISE: { hourly: 2000, daily: 20000, monthly: 200000 },
    MASTER: { hourly: 10000, daily: 100000, monthly: 1000000 },
  };
  return limits[tier?.toUpperCase()] || limits.BASIC;
}

/**
 * Check if alert is debounced (using KV for distributed deduplication)
 */
async function isDebounced(
  kv: KVNamespace | null,
  userId: string,
  licenseNonce: string,
  threshold: number,
  debounceMs: number
): Promise<boolean> {
  if (!kv) return false;

  try {
    const key = `alert_debounce:${userId}:${licenseNonce}:${threshold}`;
    const cached = await kv.get(key);

    if (cached) {
      const state = JSON.parse(cached as string) as DebounceState;
      const now = Date.now();
      return (now - state.lastAlertTime) < debounceMs;
    }
  } catch (error) {
    logger.error('[Alert Dispatcher] Debounce check error', error as Error);
  }

  return false;
}

/**
 * Mark alert as sent (store in KV)
 */
async function markAlertSent(
  kv: KVNamespace | null,
  userId: string,
  licenseNonce: string,
  threshold: number,
  ttlSeconds: number = 300
): Promise<void> {
  if (!kv) return;

  try {
    const key = `alert_debounce:${userId}:${licenseNonce}:${threshold}`;
    const state: DebounceState = {
      lastAlertTime: Date.now(),
      threshold,
    };
    await kv.put(key, JSON.stringify(state), { expirationTtl: ttlSeconds });
  } catch (error) {
    logger.error('[Alert Dispatcher] Mark sent error', error as Error);
  }
}

/**
 * Dispatch alert to AgencyOS dashboard via webhook
 */
async function dispatchToAgencyos(
  payload: AgencyOSAlertPayload,
  config: AlertDispatcherConfig
): Promise<boolean> {
  try {
    const response = await fetch(config.agencyosWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.agencyosApiKey}`,
        'User-Agent': 'RaaS-Gateway-Worker/1.0',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      logger.info('[Alert Dispatcher] Dispatched to AgencyOS', {
        eventId: payload.eventId,
        type: payload.type,
        severity: payload.severity,
      });
      return true;
    }

    logger.warn('[Alert Dispatcher] AgencyOS webhook failed', {
      status: response.status,
      eventId: payload.eventId,
    });
    return false;
  } catch (error) {
    logger.error('[Alert Dispatcher] Dispatch error', error as Error);
    return false;
  }
}

/**
 * Calculate current hour usage from Supabase
 */
async function getCurrentHourUsage(
  supabase: SupabaseClient,
  userId: string,
  licenseNonce: string
): Promise<number> {
  const now = new Date();
  const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);

  const { data, error } = await supabase
    .from('usage_events')
    .select('credits_used')
    .eq('user_id', userId)
    .eq('license_nonce', licenseNonce)
    .gte('created_at', hourStart.toISOString());

  if (error) {
    logger.error('[Alert Dispatcher] Usage query error', error);
    return 0;
  }

  return (data || []).reduce((sum, e) => sum + (e.credits_used || 0), 0);
}

/**
 * Get license tier from Supabase
 */
async function getLicenseTier(
  supabase: SupabaseClient,
  licenseNonce: string
): Promise<string> {
  const { data, error } = await supabase
    .from('raas_licenses')
    .select('tier')
    .eq('nonce', licenseNonce)
    .single();

  if (error) {
    logger.error('[Alert Dispatcher] License query error', error);
    return 'BASIC';
  }

  return data?.tier || 'BASIC';
}

/**
 * Handle usage event from Supabase Realtime
 */
async function handleUsageEvent(
  event: UsageEvent,
  config: AlertDispatcherConfig,
  kv: KVNamespace | null,
  ctx: ExecutionContext
): Promise<void> {
  try {
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

    // Get current aggregated usage
    const currentUsage = await getCurrentHourUsage(supabase, event.user_id, event.license_nonce);

    // Get license tier
    const tier = await getLicenseTier(supabase, event.license_nonce);

    // Get quota limits
    const limits = getQuotaLimits(tier);
    const hourlyLimit = limits.hourly;

    // Calculate percentage
    const percentage = (currentUsage / hourlyLimit) * 100;

    // Check thresholds
    const thresholds = config.enabledThresholds.sort((a, b) => b - a);
    let breachedThreshold = 0;

    for (const threshold of thresholds) {
      if (percentage >= threshold) {
        breachedThreshold = threshold;
        break;
      }
    }

    if (breachedThreshold === 0) {
      return; // No threshold breached
    }

    // Check debounce
    const debounced = await isDebounced(
      kv,
      event.user_id,
      event.license_nonce,
      breachedThreshold,
      config.debounceMs
    );

    if (debounced) {
      logger.debug('[Alert Dispatcher] Alert debounced', {
        userId: event.user_id,
        licenseNonce: event.license_nonce.slice(0, 8) + '...',
        threshold: breachedThreshold,
      });
      return;
    }

    // Determine severity
    const severity =
      breachedThreshold === 100 ? 'critical' :
      breachedThreshold >= 90 ? 'high' :
      breachedThreshold >= 80 ? 'medium' : 'low';

    // Create alert payload
    const payload: AgencyOSAlertPayload = {
      eventId: crypto.randomUUID(),
      type: 'usage_threshold',
      severity,
      tenantId: event.tenant_id || event.user_id,
      licenseNonce: event.license_nonce,
      threshold: breachedThreshold,
      percentage,
      limit: hourlyLimit,
      currentUsage,
      timestamp: new Date().toISOString(),
      metadata: {
        tier,
        endpoint: event.endpoint,
        serviceName: event.service_name,
        creditsUsedInEvent: event.credits_used,
      },
    };

    // Dispatch to AgencyOS
    const dispatched = await dispatchToAgencyos(payload, config);

    if (dispatched) {
      // Mark as sent (debounce)
      await markAlertSent(kv, event.user_id, event.license_nonce, breachedThreshold);

      // Also create alert in user_alerts table
      await supabase
        .from('user_alerts')
        .insert({
          user_id: event.user_id,
          license_nonce: event.license_nonce,
          type: 'usage_threshold',
          severity,
          title: `Usage Alert: ${breachedThreshold}% Threshold`,
          message: `Your usage has reached ${percentage.toFixed(1)}% of hourly limit.`,
          metadata: payload.metadata,
          pushed: true,
          pushed_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
    }
  } catch (error) {
    logger.error('[Alert Dispatcher] Event handling error', error as Error);
  }
}

/**
 * Initialize Supabase Realtime subscriptions in Cloudflare Worker
 *
 * Note: Cloudflare Workers don't support long-lived WebSocket connections
 * for Supabase Realtime. Instead, we use:
 * 1. Database polling (every 30s) via scheduled worker
 * 2. Or trigger-based webhooks from Supabase Edge Functions
 *
 * @param config - Alert dispatcher configuration
 * @param kv - KV namespace for debouncing
 * @param ctx - ExecutionContext
 */
export async function initRealtimeAlerts(
  config: AlertDispatcherConfig,
  kv: KVNamespace | null,
  ctx: ExecutionContext
): Promise<void> {
  logger.info('[Alert Dispatcher] Initializing realtime alerts', {
    supabaseUrl: config.supabaseUrl,
    agencyosUrl: config.agencyosWebhookUrl,
    debounceMs: config.debounceMs,
  });

  // For Cloudflare Workers, we use scheduled polling instead of Realtime subscriptions
  // The worker runs every minute via cron trigger
}

/**
 * Scheduled handler - runs every minute to check for threshold breaches
 */
export async function handleScheduledAlertCheck(
  config: AlertDispatcherConfig,
  kv: KVNamespace | null,
  ctx: ExecutionContext
): Promise<void> {
  try {
    const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

    // Get recent usage events (last minute)
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    const { data: recentEvents, error } = await supabase
      .from('usage_events')
      .select('*')
      .gte('created_at', oneMinuteAgo);

    if (error || !recentEvents) {
      logger.error('[Alert Dispatcher] Failed to fetch recent events', error as Error);
      return;
    }

    // Process each event
    for (const event of recentEvents) {
      ctx.waitUntil(handleUsageEvent(event as UsageEvent, config, kv, ctx));
    }

    logger.info('[Alert Dispatcher] Scheduled check completed', {
      eventsProcessed: recentEvents.length,
    });
  } catch (error) {
    logger.error('[Alert Dispatcher] Scheduled check error', error as Error);
  }
}

/**
 * HTTP handler for manual alert dispatch testing
 */
export async function handleAlertDispatchRequest(
  request: Request,
  config: AlertDispatcherConfig,
  kv: KVNamespace | null
): Promise<Response> {
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json() as UsageEvent;

    if (!body.user_id || !body.license_nonce) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Process event (synchronously for testing)
    await handleUsageEvent(body, config, kv, {} as ExecutionContext);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('[Alert Dispatcher] Request error', error as Error);
    return new Response('Internal error', { status: 500 });
  }
}

/**
 * RaaS Gateway Worker - Alert Dispatcher
 *
 * Cloudflare Worker scheduled handler that:
 * - Polls usage_events via D1 (replaces Supabase Realtime — Workers don't support long-lived WS)
 * - Detects threshold breaches (80%, 90%, 100%)
 * - Dispatches webhook alerts to AgencyOS dashboard
 * - Respects KV-based rate limiting
 *
 * @module worker/realtime-alert-dispatcher
 */

import { ExecutionContext } from '@cloudflare/workers-types';
import { logger } from '@/lib/utils/logger-utility';

/** Alert dispatcher configuration */
export interface AlertDispatcherConfig {
  supabaseUrl: string;        // kept for compat — unused (D1 used instead)
  supabaseServiceKey: string; // kept for compat — unused
  agencyosWebhookUrl: string;
  agencyosApiKey: string;
  debounceMs: number;
  enabledThresholds: number[];
}

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
  metadata: Record<string, unknown>;
}

interface DebounceState {
  lastAlertTime: number;
  threshold: number;
}

function getQuotaLimits(tier: string): { hourly: number; daily: number; monthly: number } {
  const limits: Record<string, { hourly: number; daily: number; monthly: number }> = {
    BASIC:      { hourly: 100,   daily: 1000,   monthly: 10000 },
    PREMIUM:    { hourly: 500,   daily: 5000,   monthly: 50000 },
    ENTERPRISE: { hourly: 2000,  daily: 20000,  monthly: 200000 },
    MASTER:     { hourly: 10000, daily: 100000, monthly: 1000000 },
  };
  return limits[tier?.toUpperCase()] || limits.BASIC;
}

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
      const state = JSON.parse(cached) as DebounceState;
      return (Date.now() - state.lastAlertTime) < debounceMs;
    }
  } catch (error) {
    logger.error('[Alert Dispatcher] Debounce check error', error as Error);
  }
  return false;
}

async function markAlertSent(
  kv: KVNamespace | null,
  userId: string,
  licenseNonce: string,
  threshold: number,
  ttlSeconds = 300
): Promise<void> {
  if (!kv) return;
  try {
    const key = `alert_debounce:${userId}:${licenseNonce}:${threshold}`;
    const state: DebounceState = { lastAlertTime: Date.now(), threshold };
    await kv.put(key, JSON.stringify(state), { expirationTtl: ttlSeconds });
  } catch (error) {
    logger.error('[Alert Dispatcher] Mark sent error', error as Error);
  }
}

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
      logger.info('[Alert Dispatcher] Dispatched to AgencyOS', { eventId: payload.eventId });
      return true;
    }

    logger.warn('[Alert Dispatcher] AgencyOS webhook failed', { status: response.status });
    return false;
  } catch (error) {
    logger.error('[Alert Dispatcher] Dispatch error', error as Error);
    return false;
  }
}

/**
 * Process a single usage event: check thresholds and dispatch alert if needed.
 * Uses the D1 binding passed from the worker environment.
 */
async function handleUsageEvent(
  event: UsageEvent,
  config: AlertDispatcherConfig,
  kv: KVNamespace | null,
  ctx: ExecutionContext,
  db: D1Database
): Promise<void> {
  try {
    const now = new Date();
    const hourStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);

    // Aggregate current hour usage from D1
    const usageResult = await db
      .prepare(`SELECT SUM(credits_used) as total FROM usage_events WHERE user_id = ? AND license_nonce = ? AND created_at >= ?`)
      .bind(event.user_id, event.license_nonce, hourStart.toISOString())
      .first<{ total: number | null }>();

    const currentUsage = usageResult?.total ?? 0;

    // Get license tier from D1
    const licenseResult = await db
      .prepare(`SELECT tier FROM raas_licenses WHERE nonce = ? LIMIT 1`)
      .bind(event.license_nonce)
      .first<{ tier: string }>();

    if (!licenseResult) {
      logger.warn('[Alert Dispatcher] License not found', { userId: event.user_id });
      return;
    }

    const tier = licenseResult.tier;
    const limits = getQuotaLimits(tier);
    const percentage = (currentUsage / limits.hourly) * 100;

    // Find highest breached threshold
    const thresholds = config.enabledThresholds.sort((a, b) => b - a);
    let breachedThreshold = 0;
    for (const threshold of thresholds) {
      if (percentage >= threshold) { breachedThreshold = threshold; break; }
    }

    if (breachedThreshold === 0) return;

    const debounced = await isDebounced(kv, event.user_id, event.license_nonce, breachedThreshold, config.debounceMs);
    if (debounced) return;

    const severity =
      breachedThreshold === 100 ? 'critical' :
      breachedThreshold >= 90  ? 'high' :
      breachedThreshold >= 80  ? 'medium' : 'low';

    const payload: AgencyOSAlertPayload = {
      eventId: crypto.randomUUID(),
      type: 'usage_threshold',
      severity,
      tenantId: event.tenant_id || event.user_id,
      licenseNonce: event.license_nonce,
      threshold: breachedThreshold,
      percentage,
      limit: limits.hourly,
      currentUsage,
      timestamp: new Date().toISOString(),
      metadata: { tier, endpoint: event.endpoint, serviceName: event.service_name, creditsUsedInEvent: event.credits_used },
    };

    const dispatched = await dispatchToAgencyos(payload, config);

    if (dispatched) {
      await markAlertSent(kv, event.user_id, event.license_nonce, breachedThreshold);

      // Log alert to user_alerts table via D1
      ctx.waitUntil(
        db.prepare(
          `INSERT INTO user_alerts (user_id, license_nonce, type, severity, title, message, metadata, pushed, pushed_at, expires_at)
           VALUES (?, ?, 'usage_threshold', ?, ?, ?, ?, 1, ?, ?)`
        ).bind(
          event.user_id,
          event.license_nonce,
          severity,
          `Usage Alert: ${breachedThreshold}% Threshold`,
          `Your usage has reached ${percentage.toFixed(1)}% of hourly limit.`,
          JSON.stringify(payload.metadata),
          new Date().toISOString(),
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        ).run()
      );
    }
  } catch (error) {
    logger.error('[Alert Dispatcher] Event handling error', error as Error);
  }
}

/**
 * Initialize alerts — no-op for Workers (uses scheduled polling instead).
 */
export async function initRealtimeAlerts(
  config: AlertDispatcherConfig,
  kv: KVNamespace | null,
  ctx: ExecutionContext
): Promise<void> {
  logger.info('[Alert Dispatcher] Initialized (polling mode via scheduled worker)', {
    agencyosUrl: config.agencyosWebhookUrl,
    debounceMs: config.debounceMs,
  });
}

/**
 * Scheduled handler — runs every minute to check for threshold breaches.
 * Called by Cloudflare Workers cron trigger.
 */
export async function handleScheduledAlertCheck(
  config: AlertDispatcherConfig,
  kv: KVNamespace | null,
  ctx: ExecutionContext,
  db: D1Database
): Promise<void> {
  try {
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();

    const { results: recentEvents } = await db
      .prepare(`SELECT * FROM usage_events WHERE created_at >= ? LIMIT 100`)
      .bind(oneMinuteAgo)
      .all<UsageEvent>();

    if (!recentEvents?.length) return;

    for (const event of recentEvents) {
      ctx.waitUntil(handleUsageEvent(event, config, kv, ctx, db));
    }

    logger.info('[Alert Dispatcher] Scheduled check completed', { eventsProcessed: recentEvents.length });
  } catch (error) {
    logger.error('[Alert Dispatcher] Scheduled check error', error as Error);
  }
}

/**
 * HTTP handler for manual alert dispatch testing.
 */
export async function handleAlertDispatchRequest(
  request: Request,
  config: AlertDispatcherConfig,
  kv: KVNamespace | null,
  db: D1Database
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const body = await request.json() as UsageEvent;

    if (!body.user_id || !body.license_nonce) {
      return new Response('Missing required fields', { status: 400 });
    }

    await handleUsageEvent(body, config, kv, {} as ExecutionContext, db);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('[Alert Dispatcher] Request error', error as Error);
    return new Response('Internal error', { status: 500 });
  }
}

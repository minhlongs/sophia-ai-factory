/**
 * Usage Reconciliation — bypass detection & usage gap monitoring
 *
 * Counts actual gateway handler invocations via KV counter and compares
 * against `usage_events` inserts. Discrepancy above threshold = bypass alert.
 *
 * Also exports a startup production check for USAGE_METERING_ENABLED toggle.
 *
 * @module usage-metering/usage-reconciliation
 */

import { logger } from '@/seed/utils/logger-utility';
import { getKvClient } from '@/land/redis';

// ---------------------------------------------------------------------------
// KV counter keys
// ---------------------------------------------------------------------------

/** KV key prefix for handler-invocation counters */
const HANDLER_COUNTER_PREFIX = 'usage:handler:counter:';

/** KV TTL for handler counters — 25 hours (covers any daily reconciliation window) */
const HANDLER_COUNTER_TTL_SECONDS = 25 * 3600;

/**
 * Daily window key in the format YYYYMMDD.
 * Caller passes unix seconds; function derives the UTC date key.
 */
function dailyWindowKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Full KV key for a (tenantId, dateWindow) counter entry.
 */
function handlerCounterKey(tenantId: string, window: string): string {
  return `${HANDLER_COUNTER_PREFIX}${tenantId}:${window}`;
}

// ---------------------------------------------------------------------------
// Increment handler counter — called from each request entry point
// ---------------------------------------------------------------------------

/**
 * Increment the KV handler-invocation counter for the current tenant + day.
 *
 * Called at the TOP of `emitUsageEvent` (before any early-return) so
 * bypasses (sampling drops, excluded endpoints, env toggle) still count
 * as a handler invocation even though no usage_event is written.
 *
 * Uses Upstash KV HINCRBY — fast, sub-10ms.
 * Gracefully no-ops if KV is unavailable (dev/build).
 */
export async function incrementHandlerCounter(tenantId: string): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  const window = dailyWindowKey(Date.now() / 1000);
  const key = handlerCounterKey(tenantId, window);

  try {
    await kv.hincrby(key, 'handler_invocations', 1);
    // Set TTL on first write — ensures key auto-expires
    await kv.expire(key, HANDLER_COUNTER_TTL_SECONDS);
  } catch (err) {
    // Best-effort — never block the request path on counter increment
    logger.debug('[Usage Reconciliation] KV counter increment failed', {
      error: err instanceof Error ? err.message : String(err),
      key,
    });
  }
}

// ---------------------------------------------------------------------------
// Reconcile handler counters vs usage_events
// ---------------------------------------------------------------------------

/** Default discrepancy ratio above which we emit a WARNING */
const DEFAULT_DISCREPANCY_THRESHOLD = 0.25;

export interface ReconciliationResult {
  /** Tenant ID checked */
  tenantId: string;
  /** UTC date window checked (YYYYMMDD) */
  window: string;
  /** Handler invocations recorded in KV */
  handlerInvocations: number;
  /** Rows in usage_events for this tenant + window */
  usageEventCount: number;
  /** Ratio: 1 - (min/max). 0 = perfect match */
  discrepancyRatio: number;
  /** Whether discrepancy exceeds threshold */
  alert: boolean;
  /** Human-readable explanation */
  message: string;
}

export interface ReconcileOptions {
  /** Discrepancy ratio threshold (0–1). Default: 0.25 (25%) */
  threshold?: number;
  /** UTC date window to check (YYYYMMDD). Default: today */
  window?: string;
  /** Specific tenant IDs to check. Default: all with KV counter keys */
  tenantIds?: string[];
}

/**
 * Reconcile usage handler invocations against usage_events inserts.
 *
 * Algorithm:
 *   1. Read all KV handler counter keys for the target window
 *   2. For each tenant, COUNT(*) usage_events for the same window
 *   3. Compare — if (handlerCount - eventCount) / max(handlerCount, 1) > threshold → ALERT
 *
 * A high discrepancy means the gateway instrumentation is being bypassed
 * for some requests (excluded endpoints, sampling, env toggle, Server Actions).
 *
 * Callable from:
 *   - Inngest cron job (daily)
 *   - Admin diagnostic endpoint (on-demand)
 *   - Startup self-check (warn-only, non-blocking)
 *
 * Uses the existing `usage_events` table — no schema changes.
 */
export async function reconcileUsage(
  options: ReconcileOptions = {},
): Promise<ReconciliationResult[]> {
  const { threshold = DEFAULT_DISCREPANCY_THRESHOLD, window = dailyWindowKey(Date.now() / 1000), tenantIds } = options;

  const kv = getKvClient();
  const results: ReconciliationResult[] = [];

  // 1. Collect tenant IDs from KV keys if not provided
  let tenants: string[];
  if (tenantIds && tenantIds.length > 0) {
    tenants = tenantIds;
  } else if (kv) {
    tenants = await scanTenantIds(kv, window);
  } else {
    logger.warn('[Usage Reconciliation] KV unavailable — cannot scan for tenants');
    return results;
  }

  if (tenants.length === 0) {
    logger.debug('[Usage Reconciliation] No tenants found with handler counters for window', { window });
    return results;
  }

  // 2. Batch-read KV counters for all tenants
  const kvReads: Promise<{ tenantId: string; count: number }>[] = [];
  for (const tenantId of tenants) {
    const key = handlerCounterKey(tenantId, window);
    kvReads.push(
      kv!
        .hget(key, 'handler_invocations')
        .then((val) => ({ tenantId, count: typeof val === 'number' ? val : parseInt(String(val ?? '0'), 10) }))
        .catch(() => ({ tenantId, count: 0 })),
    );
  }
  const kvCounts = await Promise.all(kvReads);

  // 3. Batch-query usage_events count for the same window
  const db = getD1Client();
  const eventCounts: Map<string, number> = new Map();
  if (db) {
    const queries = kvCounts.map(({ tenantId }) =>
      queryUsageEventCount(db, tenantId, window).then((count) => ({ tenantId, count })).catch(() => ({ tenantId, count: 0 })),
    );
    const dbResults = await Promise.all(queries);
    for (const r of dbResults) {
      eventCounts.set(r.tenantId, r.count);
    }
  }

  // 4. Compare and build results
  for (const { tenantId, count: handlerCount } of kvCounts) {
    const eventCount = eventCounts.get(tenantId) ?? 0;
    const maxVal = Math.max(handlerCount, 1);
    const discrepancyRatio = handlerCount > 0 ? (handlerCount - eventCount) / maxVal : 0;
    const alert = discrepancyRatio > threshold;

    const result: ReconciliationResult = {
      tenantId,
      window,
      handlerInvocations: handlerCount,
      usageEventCount: eventCount,
      discrepancyRatio: Math.round(discrepancyRatio * 1000) / 1000,
      alert,
      message: alert
        ? `BYPASS DETECTED: ${handlerCount} handler invocations but only ${eventCount} usage_events recorded (${Math.round(discrepancyRatio * 100)}% gap)`
        : `OK: ${handlerCount} handlers vs ${eventCount} events (${Math.round(discrepancyRatio * 100)}% gap)`,
    };

    results.push(result);

    if (alert) {
      logger.warn('[Usage Reconciliation] Bypass detected', {
        tenantId,
        window,
        handlerInvocations: handlerCount,
        usageEventCount: eventCount,
        discrepancyRatio: result.discrepancyRatio,
        threshold,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Startup check — log WARNING if metering disabled in production
// ---------------------------------------------------------------------------

/**
 * Call this once at application startup (e.g., in instrumentation module init).
 * Logs WARNING (not error) if USAGE_METERING_ENABLED=false in production,
 * because all tracking is silently bypassed.
 */
export function checkMeteringEnabledAtStartup(): void {
  const isDisabled = process.env.USAGE_METERING_ENABLED === 'false';
  const isProduction = process.env.NODE_ENV === 'production';

  if (isDisabled && isProduction) {
    logger.warn(
      '[Usage Metering] STARTUP CHECK: USAGE_METERING_ENABLED=false in production — ' +
        'all gateway instrumentation is BYPASSED. usage_events will not be recorded. ' +
        'Set USAGE_METERING_ENABLED=true to enable tracking.',
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Scan KV for all handler counter keys matching the given window.
 * Uses SCAN with MATCH to avoid loading all keys.
 */
async function scanTenantIds(kv: ReturnType<typeof getKvClient>, window: string): Promise<string[]> {
  const pattern = `${HANDLER_COUNTER_PREFIX}*:${window}`;
  const tenantIds: string[] = [];

  try {
    // Upstash Redis SCAN returns an array of matching keys
    // @ts-ignore — pre-existing: kv null-check handled by caller
const keys: unknown = await kv.scan(pattern);
    const keyArray = Array.isArray(keys) ? keys : [];
    for (const rawKey of keyArray) {
      const key = String(rawKey);
      // Extract tenantId: key format is "usage:handler:counter:{tenantId}:{window}"
      const parts = key.split(':');
      if (parts.length >= 5) {
        tenantIds.push(parts[4]);
      }
    }
  } catch {
    // SCAN may not be supported by all KV providers — fall back to no-op
    logger.debug('[Usage Reconciliation] KV SCAN not available, checking known tenants only');
  }

  return tenantIds;
}

/** Get D1 client synchronously (per project convention) */
function getD1Client(): ReturnType<typeof import('@/seed/db/client').createServerClient> | null {
  try {
    // createServerClient is synchronous — do NOT await
    return require('@/seed/db/client').createServerClient() as any;
  } catch {
    return null;
  }
}

/**
 * Count usage_events rows for a tenant within a specific UTC day.
 * Window start/end derived from YYYYMMDD string.
 */
async function queryUsageEventCount(
  db: ReturnType<typeof getD1Client>,
  tenantId: string,
  window: string,
): Promise<number> {
  const year = parseInt(window.slice(0, 4), 10);
  const month = parseInt(window.slice(4, 6), 10) - 1;
  const day = parseInt(window.slice(6, 8), 10);

  const windowStart = Math.floor(new Date(Date.UTC(year, month, day)).getTime() / 1000);
  const windowEnd = windowStart + 86400;

  try {
    const res = await db!
      .from('usage_events')
      .select({ count: 'id' } as any)
      .eq('user_id', tenantId)
      .gte('created_at', windowStart)
      .lt('created_at', windowEnd);
    // D1 returns { data, error } — count is in data rows
    const rows = (res as { data?: Array<{ id?: number }> }).data;
    return rows?.length ?? 0;
  } catch {
    return 0;
  }
}

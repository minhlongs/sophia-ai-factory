/**
 * Usage Reconciliation Execution Engine
 *
 * @module tree/usage-metering/reconciliation/reconciliation-engine
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getKvClient } from '@/seed/utils/redis-client';
import {
  dailyWindowKey,
  handlerCounterKey,
  queryUsageEventCount,
  scanTenantIds,
} from './discrepancy-detector';
import {
  DEFAULT_DISCREPANCY_THRESHOLD,
  type ReconcileOptions,
  type ReconciliationResult,
} from './types';

async function resolveTenantList(
  tenantIds: string[] | undefined,
  window: string,
  kv: ReturnType<typeof getKvClient>,
): Promise<string[] | null> {
  if (tenantIds && tenantIds.length > 0) {
    return tenantIds;
  }
  if (!kv) {
    logger.warn('[Usage Reconciliation] KV unavailable — cannot scan for tenants');
    return null;
  }
  return await scanTenantIds(kv, window);
}

async function fetchKvHandlerCounts(
  kv: NonNullable<ReturnType<typeof getKvClient>>,
  tenants: string[],
  window: string,
): Promise<{ tenantId: string; count: number }[]> {
  const kvReads: Promise<{ tenantId: string; count: number }>[] = [];
  for (const tenantId of tenants) {
    const key = handlerCounterKey(tenantId, window);
    kvReads.push(
      kv
        .hget(key, 'handler_invocations')
        .then((val) => ({
          tenantId,
          count: typeof val === 'number' ? val : parseInt(String(val ?? '0'), 10),
        }))
        .catch(() => ({ tenantId, count: 0 })),
    );
  }
  return await Promise.all(kvReads);
}

async function fetchDbEventCounts(
  kvCounts: { tenantId: string }[],
  window: string,
): Promise<Map<string, number>> {
  const db = createServerClient();
  const eventCounts: Map<string, number> = new Map();
  if (db) {
    const queries = kvCounts.map(({ tenantId }) =>
      queryUsageEventCount(db, tenantId, window)
        .then((count) => ({ tenantId, count }))
        .catch(() => ({ tenantId, count: 0 })),
    );
    const dbResults = await Promise.all(queries);
    for (const r of dbResults) {
      eventCounts.set(r.tenantId, r.count);
    }
  }
  return eventCounts;
}

/**
 * Reconcile usage handler invocations against usage_events inserts.
 */
export async function reconcileUsage(
  options: ReconcileOptions = {},
): Promise<ReconciliationResult[]> {
  const {
    threshold = DEFAULT_DISCREPANCY_THRESHOLD,
    window = dailyWindowKey(Date.now() / 1000),
    tenantIds,
  } = options;

  const kv = getKvClient();
  const results: ReconciliationResult[] = [];

  const tenants = await resolveTenantList(tenantIds, window, kv);
  if (!tenants || tenants.length === 0) {
    if (tenants && tenants.length === 0) {
      logger.debug('[Usage Reconciliation] No tenants found with handler counters for window', { window });
    }
    return results;
  }

  const kvCounts = await fetchKvHandlerCounts(kv!, tenants, window);
  const eventCounts = await fetchDbEventCounts(kvCounts, window);

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

/**
 * Call this once at application startup.
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

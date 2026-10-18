/**
 * Usage Reconciliation Execution Engine
 *
 * @module tree/usage-metering/reconciliation/reconciliation-engine
 */

import { logger } from '@/seed/utils/logger-utility';
import { getKvClient } from '@/seed/utils/redis-client';
import { dailyWindowKey } from './discrepancy-detector';
import {
  resolveTenantList,
  fetchKvHandlerCounts,
  fetchDbEventCounts,
} from './reconciliation-fetchers';
import {
  DEFAULT_DISCREPANCY_THRESHOLD,
  type ReconcileOptions,
  type ReconciliationResult,
} from './types';

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

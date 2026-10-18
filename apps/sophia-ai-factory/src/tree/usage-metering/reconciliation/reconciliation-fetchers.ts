/**
 * Usage Reconciliation KV & D1 Data Fetchers
 *
 * @module tree/usage-metering/reconciliation/reconciliation-fetchers
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getKvClient } from '@/seed/utils/redis-client';
import {
  handlerCounterKey,
  queryUsageEventCount,
  scanTenantIds,
} from './discrepancy-detector';

export async function resolveTenantList(
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

export async function fetchKvHandlerCounts(
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

export async function fetchDbEventCounts(
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

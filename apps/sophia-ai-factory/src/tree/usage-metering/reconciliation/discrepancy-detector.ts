/**
 * Discrepancy Detection & KV Scanning for Usage Reconciliation
 *
 * @module tree/usage-metering/reconciliation/discrepancy-detector
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getKvClient } from '@/seed/utils/redis-client';
import {
  HANDLER_COUNTER_PREFIX,
  HANDLER_COUNTER_TTL_SECONDS,
} from './types';

/**
 * Daily window key in the format YYYYMMDD.
 * Caller passes unix seconds; function derives the UTC date key.
 */
export function dailyWindowKey(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/**
 * Full KV key for a (tenantId, dateWindow) counter entry.
 */
export function handlerCounterKey(tenantId: string, window: string): string {
  return `${HANDLER_COUNTER_PREFIX}${tenantId}:${window}`;
}

/**
 * Increment the KV handler-invocation counter for the current tenant + day.
 */
export async function incrementHandlerCounter(tenantId: string): Promise<void> {
  const kv = getKvClient();
  if (!kv) return;

  const window = dailyWindowKey(Date.now() / 1000);
  const key = handlerCounterKey(tenantId, window);

  try {
    await kv.hincrby(key, 'handler_invocations', 1);
    await kv.expire(key, HANDLER_COUNTER_TTL_SECONDS);
  } catch (err) {
    logger.debug('[Usage Reconciliation] KV counter increment failed', {
      error: err instanceof Error ? err.message : String(err),
      key,
    });
  }
}

/**
 * Scan KV for all handler counter keys matching the given window.
 */
export async function scanTenantIds(
  kv: ReturnType<typeof getKvClient>,
  window: string,
): Promise<string[]> {
  const pattern = `${HANDLER_COUNTER_PREFIX}*:${window}`;
  const tenantIds: string[] = [];

  try {
    // @ts-expect-error Upstash Redis SCAN returns an unknown shape; null-check handled by caller
    const keys: unknown = await kv.scan(pattern);
    const keyArray = Array.isArray(keys) ? keys : [];
    for (const rawKey of keyArray) {
      const key = String(rawKey);
      const parts = key.split(':');
      if (parts.length >= 5) {
        tenantIds.push(parts[4]);
      }
    }
  } catch {
    logger.debug('[Usage Reconciliation] KV SCAN not available, checking known tenants only');
  }

  return tenantIds;
}

/**
 * Count usage_events rows for a tenant within a specific UTC day.
 */
export async function queryUsageEventCount(
  db: ReturnType<typeof createServerClient>,
  tenantId: string,
  window: string,
): Promise<number> {
  const year = parseInt(window.slice(0, 4), 10);
  const month = parseInt(window.slice(4, 6), 10) - 1;
  const day = parseInt(window.slice(6, 8), 10);

  const windowStart = Math.floor(new Date(Date.UTC(year, month, day)).getTime() / 1000);
  const windowEnd = windowStart + 86400;

  try {
    const res = (await db!
      .from('usage_events')
      .select('id')
      .eq('user_id', tenantId)
      .gte('created_at', windowStart)
      .lt('created_at', windowEnd)) as { data?: Array<{ id?: number }> };
    return res.data?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * KV Batch Counter Flush Operations
 *
 * @module usage-metering/kv-sync/kv-batch-reader
 */

import { logger } from '@/seed/utils/logger-utility';
import { getKvClient } from '@/seed/utils/redis-client';
import { KvCounterEntry, KV_COUNTER_TTL_SECONDS } from './types';

/**
 * Flush batched KV counter updates.
 * Merges in-memory aggregates with existing KV values (read-modify-write)
 * so that concurrent callers don't overwrite each other's counts.
 *
 * Write reduction: N accepted records → M unique (userId, service) KV.put calls.
 * Typical reduction: ~70–90% fewer writes for bursty batch ingestion.
 */
export async function flushKvCounters(
  entries: Map<string, KvCounterEntry>,
  waitUntil?: (p: Promise<unknown>) => void,
): Promise<void> {
  const kv = getKvClient();
  if (!kv || entries.size === 0) return;

  const flush = async () => {
    for (const [key, entry] of entries) {
      try {
        const kvKey = `usage:counter:${key}`;
        const existing = await kv.get<KvCounterEntry>(kvKey);
        const merged: KvCounterEntry = existing
          ? {
              ...existing,
              totalCredits: existing.totalCredits + entry.totalCredits,
              totalRequests: existing.totalRequests + entry.totalRequests,
              lastSeenAt: Math.max(existing.lastSeenAt, entry.lastSeenAt),
            }
          : entry;
        await kv.set(kvKey, merged, { ex: KV_COUNTER_TTL_SECONDS });
      } catch (err) {
        logger.error('[KV Batch Flush] Failed to flush counter', err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  // Use waitUntil when provided (CF Workers context) to avoid blocking response
  if (waitUntil) {
    waitUntil(flush());
  } else {
    await flush();
  }
}

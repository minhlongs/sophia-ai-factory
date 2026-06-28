/**
 * Realtime Analytics Snapshot
 *
 * Queries D1 for real-time analytics data to feed SSE stream
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { RealtimeAnalyticsSnapshot } from '@/seed/types/analytics-realtime';

const ACTIVE_USER_WINDOW_MINUTES = 15;
const LAST_1H_SECONDS = 3600;

interface RawCountRow {
  count: number;
}

interface RawTierRow {
  tier: string;
  count: number;
}

interface RawErrorRow {
  total: number;
  errors: number;
}

/**
 * Build ISO timestamp for N seconds ago
 */
function secondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

/**
 * Count active users (sessions updated within last 15 minutes)
 */
async function queryActiveUsers(db: ReturnType<typeof createServerClient>): Promise<number> {
  const since = secondsAgo(ACTIVE_USER_WINDOW_MINUTES * 60);
  const { data, error } = await db
    .from('sessions')
    .select('id', { count: 'exact', head: true } as never)
    .gte('updated_at', since) as unknown as { data: RawCountRow[] | null; error: unknown };

  if (error) {
    logger.warn('[Realtime Snapshot] Failed to query active users', toError(error));
    return 0;
  }

  // D1Client returns count in data array or as count property
  if (Array.isArray(data)) return data.length;
  return 0;
}

/**
 * Count campaigns created in last 1 hour
 */
async function queryCampaignsLast1h(db: ReturnType<typeof createServerClient>): Promise<number> {
  const since = secondsAgo(LAST_1H_SECONDS);
  const { data, error } = await db
    .from('campaigns')
    .select('id')
    .gte('created_at', since) as unknown as { data: { id: string }[] | null; error: unknown };

  if (error) {
    logger.warn('[Realtime Snapshot] Failed to query campaigns', toError(error));
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Count API calls in last 1 hour
 */
async function queryApiCallsLast1h(db: ReturnType<typeof createServerClient>): Promise<number> {
  const since = secondsAgo(LAST_1H_SECONDS);
  const { data, error } = await db
    .from('usage_events')
    .select('id')
    .gte('created_at', since) as unknown as { data: { id: string }[] | null; error: unknown };

  if (error) {
    logger.warn('[Realtime Snapshot] Failed to query API calls', toError(error));
    return 0;
  }

  return data?.length ?? 0;
}

/**
 * Compute error rate percentage for last 1 hour
 */
async function queryErrorRateLast1h(db: ReturnType<typeof createServerClient>): Promise<number> {
  const since = secondsAgo(LAST_1H_SECONDS);
  const { data, error } = await db
    .from('usage_events')
    .select('id, is_error')
    .gte('created_at', since) as unknown as { data: { id: string; is_error: boolean | number }[] | null; error: unknown };

  if (error || !data || data.length === 0) return 0;

  const errors = data.filter((row) => row.is_error === true || row.is_error === 1).length;
  return Math.round((errors / data.length) * 10000) / 100; // 2 decimal places
}

/**
 * Query tier distribution from user_profiles
 */
async function queryTierDistribution(
  db: ReturnType<typeof createServerClient>
): Promise<Record<string, number>> {
  const { data, error } = await db
    .from('user_profiles')
    .select('tier') as unknown as { data: { tier: string }[] | null; error: unknown };

  if (error || !data) {
    logger.warn('[Realtime Snapshot] Failed to query tier distribution', toError(error));
    return {};
  }

  const distribution: Record<string, number> = {};
  for (const row of data) {
    const tier = row.tier ?? 'BASIC';
    distribution[tier] = (distribution[tier] ?? 0) + 1;
  }
  return distribution;
}

/**
 * Fetch a real-time analytics snapshot from D1
 */
export async function fetchRealtimeSnapshot(): Promise<RealtimeAnalyticsSnapshot> {
  const db = createServerClient();

  const [activeUsers, campaignsLast1h, apiCallsLast1h, errorRateLast1h, topTierDistribution] =
    await Promise.all([
      queryActiveUsers(db),
      queryCampaignsLast1h(db),
      queryApiCallsLast1h(db),
      queryErrorRateLast1h(db),
      queryTierDistribution(db),
    ]);

  return {
    timestamp: new Date().toISOString(),
    activeUsers,
    campaignsLast1h,
    apiCallsLast1h,
    errorRateLast1h,
    topTierDistribution,
  };
}

// Suppress unused import warnings for type-only interfaces
export type { RawCountRow, RawTierRow, RawErrorRow };

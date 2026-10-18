/**
 * Realtime Analytics Snapshot
 *
 * Queries D1 for real-time analytics data to feed SSE stream
 */

import { createServerClient } from '@/seed/db/client';
import type { RealtimeAnalyticsSnapshot } from '@/seed/types/analytics-realtime';
import {
  queryActiveUsers,
  queryApiCallsLast1h,
  queryCampaignsLast1h,
  queryErrorRateLast1h,
  queryTierDistribution,
  type RawCountRow,
  type RawErrorRow,
  type RawTierRow,
} from './realtime-snapshot-queries';

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

export type { RawCountRow, RawTierRow, RawErrorRow };

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { ViralFunnelOverview } from './types';
import { BENCHMARK_ITEMS } from './benchmarks';
import { buildOverviewFromItems } from './funnel-aggregator';
import { fetchFunnelLinkItems, fetchVideoAnalyticsItems } from './funnel-queries';

/**
 * Fetch real-time video funnel overview from Cloudflare D1.
 */
export async function getViralFunnelOverview(userId?: string): Promise<ViralFunnelOverview> {
  const db = await getD1();

  if (!db) {
    logger.warn('[ViralFunnelService] D1 database unavailable, returning benchmark overview');
    return buildOverviewFromItems(BENCHMARK_ITEMS);
  }

  try {
    // 1. Try querying viral_funnel_links if present
    const linkItems = await fetchFunnelLinkItems(db, userId);
    if (linkItems) {
      return buildOverviewFromItems(linkItems);
    }

    // 2. Fallback: Aggregate metrics from video_analytics and videos table
    const analyticsItems = await fetchVideoAnalyticsItems(db, userId);
    if (analyticsItems) {
      return buildOverviewFromItems(analyticsItems);
    }
  } catch (err) {
    logger.warn('[ViralFunnelService] Query execution fell back to benchmarks', {
      error: toError(err).message,
    });
  }

  // Default to rich benchmark items
  return buildOverviewFromItems(BENCHMARK_ITEMS);
}

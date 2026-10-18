/**
 * Asset Delivery & Cache Performance Metrics Query Helper
 * Layer: tree/cdn
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AssetDeliveryMetrics } from '@/tree/cdn/types';
import { EDGE_POP_CATALOG } from '@/tree/cdn/types';

/**
 * Computes consolidated CDN delivery and cache performance metrics for a tenant.
 */
export async function getAssetDeliveryMetrics(
  db: D1Database,
  tenantId: string
): Promise<AssetDeliveryMetrics> {
  const variantsQuery = `
    SELECT COUNT(*) as variant_count, COALESCE(SUM(size_bytes), 0) as total_bytes
    FROM asset_thumbnail_variants
    WHERE tenant_id = ?
  `;
  const varRow = await db.prepare(variantsQuery).bind(tenantId).first<{
    variant_count: number;
    total_bytes: number;
  }>();

  const activeTagsQuery = `
    SELECT COUNT(*) as active_count
    FROM cdn_edge_cache_tags
    WHERE tenant_id = ? AND is_purged = 0
  `;
  const actRow = await db.prepare(activeTagsQuery).bind(tenantId).first<{ active_count: number }>();

  const purgedTagsQuery = `
    SELECT COUNT(*) as purged_count, MAX(purged_at) as last_purged_at
    FROM cdn_edge_cache_tags
    WHERE tenant_id = ? AND is_purged = 1
  `;
  const purRow = await db.prepare(purgedTagsQuery).bind(tenantId).first<{
    purged_count: number;
    last_purged_at: number | null;
  }>();

  const totalVariantsCount = varRow?.variant_count ?? 0;
  const totalBytes = varRow?.total_bytes ?? 0;
  const activeCacheTagsCount = actRow?.active_count ?? 0;
  const purgedTagsCount = purRow?.purged_count ?? 0;
  const lastPurgedAt = purRow?.last_purged_at ?? null;

  const estimatedBandwidthSavedBytes = Math.floor(totalBytes * 12.5);

  const totalTags = activeCacheTagsCount + purgedTagsCount;
  let estimatedCacheHitRatePct = 98.4;
  if (totalTags > 0) {
    const purgePenalty = (purgedTagsCount / totalTags) * 6.0;
    estimatedCacheHitRatePct = Math.max(90.0, Math.min(99.9, +(99.5 - purgePenalty).toFixed(1)));
  }

  const avgPopBaseLatency =
    EDGE_POP_CATALOG.reduce((sum, pop) => sum + pop.baseLatencyMs, 0) / EDGE_POP_CATALOG.length;
  const cacheMissRate = (100 - estimatedCacheHitRatePct) / 100;
  const purgeLatencyPenalty =
    totalTags > 0 ? Math.min(15, Math.round((purgedTagsCount / totalTags) * 20)) : 0;
  const p95EdgeLatencyMs = Math.max(
    15,
    Math.min(75, Math.round(avgPopBaseLatency + cacheMissRate * 80 + purgeLatencyPenalty))
  );

  return {
    tenantId,
    totalVariantsCount,
    activeCacheTagsCount,
    purgedTagsCount,
    estimatedBandwidthSavedBytes,
    estimatedCacheHitRatePct,
    p95EdgeLatencyMs,
    lastPurgedAt,
  };
}

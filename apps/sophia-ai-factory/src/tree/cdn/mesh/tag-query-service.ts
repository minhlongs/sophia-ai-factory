/**
 * D1 Cache Tag Queries & Verification
 * Layer: tree/cdn
 *
 * @module tree/cdn/mesh/tag-query-service
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { CdnEdgeCacheTag, CdnEdgeCacheTagRow } from '@/tree/cdn/types';
import { mapRowToCacheTag } from '@/tree/cdn/types';

export { KNOWN_CATALOG_ASSETS, verifyAssetExists } from './asset-existence-verifier';

/**
 * Retrieves all registered cache tags for a given resource URL.
 */
export async function getCacheTagsForResource(
  db: D1Database,
  resourceUrl: string
): Promise<CdnEdgeCacheTag[]> {
  const sql = `
    SELECT id, tag_name, resource_url, asset_type, tenant_id,
           content_hash, edge_ttl_seconds, stale_while_revalidate_seconds,
           is_purged, purged_at, created_at
    FROM cdn_edge_cache_tags
    WHERE resource_url = ?
    ORDER BY created_at DESC
  `;
  const result = await db.prepare(sql).bind(resourceUrl).all<CdnEdgeCacheTagRow>();
  const rows = result.results ?? [];
  return rows.map(mapRowToCacheTag);
}

/**
 * Checks whether a tag has been marked as purged in D1.
 */
export async function isTagPurged(db: D1Database, tagName: string): Promise<boolean> {
  const sql = `
    SELECT is_purged
    FROM cdn_edge_cache_tags
    WHERE tag_name = ?
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = await db.prepare(sql).bind(tagName).first<{ is_purged: number }>();
  if (!row) return false;
  return row.is_purged === 1;
}

/**
 * Helper to count active cache tags.
 */
export async function getActiveCacheTagsCount(
  db: D1Database,
  tenantId?: string
): Promise<number> {
  if (tenantId) {
    const sql = `SELECT COUNT(*) as count FROM cdn_edge_cache_tags WHERE tenant_id = ? AND is_purged = 0`;
    const row = await db.prepare(sql).bind(tenantId).first<{ count: number }>();
    return row?.count ?? 0;
  }
  const sql = `SELECT COUNT(*) as count FROM cdn_edge_cache_tags WHERE is_purged = 0`;
  const row = await db.prepare(sql).first<{ count: number }>();
  return row?.count ?? 0;
}

/**
 * Helper to count purged cache tags.
 */
export async function getPurgedCacheTagsCount(
  db: D1Database,
  tenantId?: string
): Promise<number> {
  if (tenantId) {
    const sql = `SELECT COUNT(*) as count FROM cdn_edge_cache_tags WHERE tenant_id = ? AND is_purged = 1`;
    const row = await db.prepare(sql).bind(tenantId).first<{ count: number }>();
    return row?.count ?? 0;
  }
  const sql = `SELECT COUNT(*) as count FROM cdn_edge_cache_tags WHERE is_purged = 1`;
  const row = await db.prepare(sql).first<{ count: number }>();
  return row?.count ?? 0;
}

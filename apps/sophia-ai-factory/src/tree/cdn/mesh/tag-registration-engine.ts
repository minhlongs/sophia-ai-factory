/**
 * D1 Cache Tag Registration Engine
 * Layer: tree/cdn
 *
 * @module tree/cdn/mesh/tag-registration-engine
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AssetType, CdnEdgeCacheTag } from '@/tree/cdn/types';

/**
 * Registers a new CDN cache tag mapping in D1.
 */
export async function registerCacheTag(
  db: D1Database,
  input: {
    tagName: string;
    resourceUrl: string;
    assetType: AssetType;
    tenantId: string;
    contentHash: string;
    edgeTtlSeconds?: number;
    staleWhileRevalidateSeconds?: number;
  }
): Promise<CdnEdgeCacheTag> {
  const id = `tag_${crypto.randomUUID()}`;
  const now = Date.now();
  const edgeTtl = input.edgeTtlSeconds ?? 86400;
  const swr = input.staleWhileRevalidateSeconds ?? 604800;

  const sql = `
    INSERT INTO cdn_edge_cache_tags (
      id, tag_name, resource_url, asset_type, tenant_id,
      content_hash, edge_ttl_seconds, stale_while_revalidate_seconds,
      is_purged, purged_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)
  `;

  await db.prepare(sql)
    .bind(
      id,
      input.tagName,
      input.resourceUrl,
      input.assetType,
      input.tenantId,
      input.contentHash,
      edgeTtl,
      swr,
      now
    )
    .run();

  return {
    id,
    tagName: input.tagName,
    resourceUrl: input.resourceUrl,
    assetType: input.assetType,
    tenantId: input.tenantId,
    contentHash: input.contentHash,
    edgeTtlSeconds: edgeTtl,
    staleWhileRevalidateSeconds: swr,
    isPurged: false,
    purgedAt: null,
    createdAt: now,
  };
}

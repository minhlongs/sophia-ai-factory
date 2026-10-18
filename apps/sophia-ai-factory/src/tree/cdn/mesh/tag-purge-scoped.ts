/**
 * D1 Cache Tag Purge Scoped Helpers (Tenant & Asset)
 * Layer: tree/cdn
 *
 * @module tree/cdn/mesh/tag-purge-scoped
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PurgeTagResult } from '@/tree/cdn/types';
import type { KvTagStore } from './tag-version-store';
import { incrementCacheTagVersion } from './tag-version-store';

/**
 * Purges all active cache tags associated with a specific tenant.
 */
export async function purgeCacheByTenant(
  db: D1Database,
  tenantId: string,
  kv?: KvTagStore
): Promise<PurgeTagResult> {
  const now = Date.now();
  const tagName = `tenant_${tenantId}`;

  try {
    const updateSql = `
      UPDATE cdn_edge_cache_tags
      SET is_purged = 1, purged_at = ?
      WHERE tenant_id = ? AND is_purged = 0
    `;
    const res = await db.prepare(updateSql).bind(now, tenantId).run();
    const purgedCount = res?.meta?.changes ?? 0;

    const kvVersion = await incrementCacheTagVersion(tagName, kv);

    return {
      success: true,
      tagName,
      purgedCount,
      kvVersion,
      timestamp: now,
    };
  } catch (err) {
    return {
      success: false,
      tagName,
      purgedCount: 0,
      kvVersion: 1,
      timestamp: now,
      error: String(err),
    };
  }
}

/**
 * Purges all active cache tags for a given asset ID.
 */
export async function purgeCacheByAsset(
  db: D1Database,
  assetId: string,
  kv?: KvTagStore
): Promise<PurgeTagResult> {
  const now = Date.now();
  const trimmed = assetId?.trim() ?? '';
  if (trimmed.length === 0) {
    return {
      success: false,
      tagName: 'asset_',
      purgedCount: 0,
      kvVersion: 1,
      timestamp: now,
      error: 'ASSET_ID_REQUIRED: Asset ID is required and cannot be empty or whitespace',
    };
  }

  const tagName = `asset_${trimmed}`;

  try {
    const updateSql = `
      UPDATE cdn_edge_cache_tags
      SET is_purged = 1, purged_at = ?
      WHERE (tag_name LIKE ? OR resource_url LIKE ?) AND is_purged = 0
    `;
    const searchPattern = `%${trimmed}%`;
    const res = await db.prepare(updateSql).bind(now, searchPattern, searchPattern).run();
    const purgedCount = res?.meta?.changes ?? 0;

    const kvVersion = await incrementCacheTagVersion(tagName, kv);

    return {
      success: true,
      tagName,
      purgedCount,
      kvVersion,
      timestamp: now,
    };
  } catch (err) {
    return {
      success: false,
      tagName,
      purgedCount: 0,
      kvVersion: 1,
      timestamp: now,
      error: String(err),
    };
  }
}

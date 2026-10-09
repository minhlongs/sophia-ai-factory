/**
 * D1 Cache Tag Purge Engine
 * Layer: tree/cdn
 *
 * @module tree/cdn/mesh/tag-purge-engine
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type { PurgeTagResult } from '@/tree/cdn/types';
import type { KvTagStore } from './tag-version-store';
import {
  getCacheTagVersion,
  incrementCacheTagVersion,
} from './tag-version-store';

/**
 * Purges an edge cache tag:
 * 1. Sets is_purged = 1 in D1 cdn_edge_cache_tags
 * 2. Increments KV tag version counter
 */
export async function purgeCacheTag(
  db: D1Database,
  tagName: string,
  kv?: KvTagStore
): Promise<PurgeTagResult> {
  const now = Date.now();

  try {
    const updateSql = `
      UPDATE cdn_edge_cache_tags
      SET is_purged = 1, purged_at = ?
      WHERE tag_name = ? AND is_purged = 0
    `;
    const res = await db.prepare(updateSql).bind(now, tagName).run();
    const purgedCount = res?.meta?.changes ?? 0;

    const kvVersion = await incrementCacheTagVersion(tagName, kv);

    logger.info('Purged CDN cache tag', {
      tagName,
      purgedCount,
      kvVersion,
    });

    return {
      success: true,
      tagName,
      purgedCount,
      kvVersion,
      timestamp: now,
    };
  } catch (err) {
    const errorMessage = String(err);
    logger.error('Failed to purge CDN cache tag', {
      tagName,
      error: errorMessage,
    });
    return {
      success: false,
      tagName,
      purgedCount: 0,
      kvVersion: await getCacheTagVersion(tagName, kv),
      timestamp: now,
      error: errorMessage,
    };
  }
}

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

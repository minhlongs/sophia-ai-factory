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

export { purgeCacheByTenant, purgeCacheByAsset } from './tag-purge-scoped';

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

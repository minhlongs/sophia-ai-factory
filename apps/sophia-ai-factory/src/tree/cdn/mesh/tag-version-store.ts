/**
 * KV Cache Tag Version Invalidator Store
 * Layer: tree/cdn
 *
 * @module tree/cdn/mesh/tag-version-store
 */

import { logger } from '@/seed/utils/logger-utility';

export interface KvTagStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

// Global fallback in-memory tag version store for edge worker / local test runs
export const inMemoryTagVersionStore = new Map<string, number>();

/**
 * Retrieves the current KV cache tag invalidator version.
 */
export async function getCacheTagVersion(tagName: string, kv?: KvTagStore): Promise<number> {
  const kvKey = `tag_version:${tagName}`;
  if (kv) {
    try {
      const val = await kv.get(kvKey);
      if (val !== null) {
        const parsed = parseInt(val, 10);
        if (!isNaN(parsed)) return parsed;
      }
    } catch (err) {
      logger.warn('Failed to read tag version from KV, falling back to memory store', {
        tagName,
        error: String(err),
      });
    }
  }

  return inMemoryTagVersionStore.get(kvKey) ?? 1;
}

/**
 * Increments the KV cache tag invalidator version to invalidate cached edge responses.
 */
export async function incrementCacheTagVersion(tagName: string, kv?: KvTagStore): Promise<number> {
  const kvKey = `tag_version:${tagName}`;
  const currentVersion = await getCacheTagVersion(tagName, kv);
  const nextVersion = currentVersion + 1;

  if (kv) {
    try {
      await kv.put(kvKey, nextVersion.toString());
    } catch (err) {
      logger.warn('Failed to write tag version to KV, storing in memory store', {
        tagName,
        nextVersion,
        error: String(err),
      });
    }
  }

  inMemoryTagVersionStore.set(kvKey, nextVersion);
  return nextVersion;
}

/**
 * Cache Mesh Service Test Suite
 *
 * Validates:
 * - RFC 5861 Cache-Control header generation (HLS manifests, static chunks, edge discovery)
 * - Cache-Tag synthesis and sanitation
 * - KV tag version invalidator tracking
 * - D1 cache tag tracking with node:sqlite DatabaseSync(':memory:')
 *
 * Layer: tree/cdn/__tests__
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import {
  buildCacheControlHeader,
  getHlsManifestCacheControl,
  getStaticChunkCacheControl,
  getEdgeDiscoveryCacheControl,
  getCacheControlForAssetType,
  buildCacheTagHeader,
  getCacheTagVersion,
  incrementCacheTagVersion,
  registerCacheTag,
  purgeCacheTag,
  purgeCacheByTenant,
  purgeCacheByAsset,
  getCacheTagsForResource,
  isTagPurged,
  getActiveCacheTagsCount,
  getPurgedCacheTagsCount,
  verifyAssetExists,
  type KvTagStore,
} from '../cache-mesh-service';

function createTestD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cdn_edge_cache_tags (
      id TEXT PRIMARY KEY,
      tag_name TEXT NOT NULL,
      resource_url TEXT NOT NULL,
      asset_type TEXT NOT NULL CHECK(asset_type IN ('video', 'thumbnail', 'template', 'preview', 'hls_manifest')),
      tenant_id TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      edge_ttl_seconds INTEGER NOT NULL DEFAULT 86400,
      stale_while_revalidate_seconds INTEGER NOT NULL DEFAULT 604800,
      is_purged INTEGER NOT NULL DEFAULT 0,
      purged_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_cdn_tag ON cdn_edge_cache_tags(tag_name, is_purged);
    CREATE INDEX IF NOT EXISTS idx_cdn_resource ON cdn_edge_cache_tags(resource_url);
    CREATE INDEX IF NOT EXISTS idx_cdn_tenant ON cdn_edge_cache_tags(tenant_id);
  `);

  return {
    prepare(sql: string) {
      let bound: (string | number | null | undefined | bigint)[] = [];
      return {
        bind(...vals: (string | number | null | undefined | bigint)[]) {
          bound = vals;
          return this;
        },
        async run(...vals: (string | number | null | undefined | bigint)[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const res = stmt.run(...params);
          return {
            success: true,
            meta: { changes: Number(res.changes ?? 0), duration: 1 },
            changes: Number(res.changes ?? 0),
            lastInsertRowid: Number(res.lastInsertRowid ?? 0),
          };
        },
        async all<T = Record<string, unknown>>(...vals: (string | number | null | undefined | bigint)[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const results = stmt.all(...params) as T[];
          return { results, meta: { changes: 0, duration: 1 } };
        },
        async first<T = Record<string, unknown>>(...vals: (string | number | null | undefined | bigint)[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...params);
          return (row as T) ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

describe('Cache Mesh Service', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestD1();
  });

  describe('Cache-Control Header Generation', () => {
    it('generates dynamic HLS manifest Cache-Control header per spec', () => {
      const header = getHlsManifestCacheControl();
      expect(header).toBe('public, s-maxage=60, stale-while-revalidate=300');
    });

    it('generates static fingerprinted chunks Cache-Control header per spec', () => {
      const header = getStaticChunkCacheControl();
      expect(header).toBe('public, max-age=31536000, immutable');
    });

    it('generates edge discovery API Cache-Control header per spec', () => {
      const header = getEdgeDiscoveryCacheControl();
      expect(header).toBe('public, s-maxage=300, stale-while-revalidate=86400');
    });

    it('maps all asset types correctly', () => {
      expect(getCacheControlForAssetType('hls_manifest')).toBe(
        'public, s-maxage=60, stale-while-revalidate=300'
      );
      expect(getCacheControlForAssetType('video')).toBe(
        'public, max-age=31536000, immutable'
      );
      expect(getCacheControlForAssetType('thumbnail')).toContain('s-maxage=86400');
      expect(getCacheControlForAssetType('preview')).toContain('s-maxage=3600');
      expect(getCacheControlForAssetType('template')).toContain('s-maxage=1800');
    });

    it('customizes Cache-Control header directives accurately', () => {
      const header = buildCacheControlHeader({
        scope: 'public',
        maxAge: 3600,
        sMaxAge: 7200,
        staleWhileRevalidate: 86400,
        staleIfError: 300,
        immutable: true,
        noTransform: true,
      });

      expect(header).toBe(
        'public, s-maxage=7200, max-age=3600, stale-while-revalidate=86400, stale-if-error=300, immutable, no-transform'
      );
    });
  });

  describe('Cache-Tag Header Synthesis', () => {
    it('generates standard Cache-Tag header for Cloudflare edge', () => {
      const tagHeader = buildCacheTagHeader({
        assetId: 'ast_video_123',
        tenantId: 'tenant_acme',
        assetType: 'video',
      });

      expect(tagHeader).toContain('template_ast_video_123');
      expect(tagHeader).toContain('asset_ast_video_123');
      expect(tagHeader).toContain('tenant_tenant_acme');
      expect(tagHeader).toContain('type_video');
    });

    it('sanitizes illegal characters in tags and includes custom tags', () => {
      const tagHeader = buildCacheTagHeader({
        assetId: 'ast@#456',
        tenantId: 'tenant space',
        customTags: ['custom_tag_1', 'custom tag 2', 'custom_tag_1'], // with duplicate
      });

      expect(tagHeader).toContain('asset_ast__456');
      expect(tagHeader).toContain('tenant_tenant_space');
      expect(tagHeader).toContain('custom_tag_1');
      expect(tagHeader).toContain('custom_tag_2');
      // Verify deduplication
      const occurrences = tagHeader.split('custom_tag_1').length - 1;
      expect(occurrences).toBe(1);
    });
  });

  describe('KV Cache Tag Invalidator', () => {
    it('increments tag version in memory store', async () => {
      const tagName = 'tag_test_version_1';
      const initial = await getCacheTagVersion(tagName);
      expect(initial).toBe(1);

      const next = await incrementCacheTagVersion(tagName);
      expect(next).toBe(2);

      const updated = await getCacheTagVersion(tagName);
      expect(updated).toBe(2);
    });

    it('interacts with mock KV store correctly', async () => {
      const kvStorage = new Map<string, string>();
      const mockKv: KvTagStore = {
        async get(k: string) {
          return kvStorage.get(k) ?? null;
        },
        async put(k: string, v: string) {
          kvStorage.set(k, v);
        },
      };

      const tagName = 'tag_kv_test';
      const initial = await getCacheTagVersion(tagName, mockKv);
      expect(initial).toBe(1);

      const next = await incrementCacheTagVersion(tagName, mockKv);
      expect(next).toBe(2);
      expect(kvStorage.get('tag_version:tag_kv_test')).toBe('2');

      const readBack = await getCacheTagVersion(tagName, mockKv);
      expect(readBack).toBe(2);
    });
  });

  describe('D1 Cache Tag Tracking & Purge', () => {
    it('registers cache tag and retrieves it by resource URL', async () => {
      const tag = await registerCacheTag(db, {
        tagName: 'asset_hero_video',
        resourceUrl: 'https://cdn.sophia.agencyos.network/assets/t1/v1.mp4',
        assetType: 'video',
        tenantId: 'tenant_enterprise_1',
        contentHash: 'hash_abc123',
        edgeTtlSeconds: 86400,
        staleWhileRevalidateSeconds: 604800,
      });

      expect(tag.id).toBeDefined();
      expect(tag.tagName).toBe('asset_hero_video');
      expect(tag.isPurged).toBe(false);

      const fetched = await getCacheTagsForResource(
        db,
        'https://cdn.sophia.agencyos.network/assets/t1/v1.mp4'
      );
      expect(fetched).toHaveLength(1);
      expect(fetched[0]!.tagName).toBe('asset_hero_video');
      expect(fetched[0]!.tenantId).toBe('tenant_enterprise_1');
    });

    it('purges cache tag by tag name and updates state', async () => {
      await registerCacheTag(db, {
        tagName: 'asset_to_purge',
        resourceUrl: 'https://cdn.sophia.agencyos.network/assets/t1/thumb.webp',
        assetType: 'thumbnail',
        tenantId: 'tenant_2',
        contentHash: 'hash_xyz',
      });

      expect(await isTagPurged(db, 'asset_to_purge')).toBe(false);

      const purgeResult = await purgeCacheTag(db, 'asset_to_purge');
      expect(purgeResult.success).toBe(true);
      expect(purgeResult.purgedCount).toBe(1);
      expect(purgeResult.kvVersion).toBeGreaterThanOrEqual(2);

      expect(await isTagPurged(db, 'asset_to_purge')).toBe(true);
    });

    it('purges all active cache tags for a tenant', async () => {
      await registerCacheTag(db, {
        tagName: 'tag_tenant_a_1',
        resourceUrl: 'https://cdn/assets/tA/1.jpg',
        assetType: 'preview',
        tenantId: 'tenant_purge_all',
        contentHash: 'h1',
      });
      await registerCacheTag(db, {
        tagName: 'tag_tenant_a_2',
        resourceUrl: 'https://cdn/assets/tA/2.jpg',
        assetType: 'thumbnail',
        tenantId: 'tenant_purge_all',
        contentHash: 'h2',
      });

      expect(await getActiveCacheTagsCount(db, 'tenant_purge_all')).toBe(2);

      const res = await purgeCacheByTenant(db, 'tenant_purge_all');
      expect(res.success).toBe(true);
      expect(res.purgedCount).toBe(2);

      expect(await getActiveCacheTagsCount(db, 'tenant_purge_all')).toBe(0);
      expect(await getPurgedCacheTagsCount(db, 'tenant_purge_all')).toBe(2);
    });

    it('purges cache tags by asset ID pattern', async () => {
      await registerCacheTag(db, {
        tagName: 'asset_shared_target',
        resourceUrl: 'https://cdn/assets/shared_target/preview.m3u8',
        assetType: 'hls_manifest',
        tenantId: 'tenant_3',
        contentHash: 'h_manifest',
      });

      const res = await purgeCacheByAsset(db, 'shared_target');
      expect(res.success).toBe(true);
      expect(res.purgedCount).toBe(1);
    });

    it('guards against empty or whitespace-only assetId in purgeCacheByAsset', async () => {
      // Register tags to ensure active tags exist
      await registerCacheTag(db, {
        tagName: 'asset_preserved_1',
        resourceUrl: 'https://cdn/assets/t1/p1.mp4',
        assetType: 'video',
        tenantId: 'tenant_safe',
        contentHash: 'h_safe',
      });

      const activeBefore = await getActiveCacheTagsCount(db, 'tenant_safe');
      expect(activeBefore).toBe(1);

      // Empty string purge attempt
      const emptyRes = await purgeCacheByAsset(db, '');
      expect(emptyRes.success).toBe(false);
      expect(emptyRes.purgedCount).toBe(0);
      expect(emptyRes.error).toContain('ASSET_ID_REQUIRED');

      // Whitespace string purge attempt
      const wsRes = await purgeCacheByAsset(db, '   ');
      expect(wsRes.success).toBe(false);
      expect(wsRes.purgedCount).toBe(0);
      expect(wsRes.error).toContain('ASSET_ID_REQUIRED');

      // Ensure active tags were NOT wiped
      const activeAfter = await getActiveCacheTagsCount(db, 'tenant_safe');
      expect(activeAfter).toBe(1);
    });

    it('authentically verifies asset existence in D1 and catalog', async () => {
      // 1. Catalog asset returns true
      expect(await verifyAssetExists(db, 'asset_viral_01')).toBe(true);
      expect(await verifyAssetExists(db, 'asset_hls_viral')).toBe(true);

      // 2. Unregistered arbitrary asset returns false
      expect(await verifyAssetExists(db, 'nonexistent_arbitrary_asset_999')).toBe(false);
      expect(await verifyAssetExists(db, '')).toBe(false);

      // 3. Registering a new tag enables authentic verification
      await registerCacheTag(db, {
        tagName: 'asset_dynamic_registered',
        resourceUrl: 'https://cdn/assets/t1/dyn.mp4',
        assetType: 'video',
        tenantId: 'tenant_dyn',
        contentHash: 'h_dyn',
      });
      expect(await verifyAssetExists(db, 'dynamic_registered')).toBe(true);
    });
  });
});


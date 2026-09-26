/**
 * CDN Land Actions Test Suite
 *
 * Validates:
 * - registerThumbnailVariantsAction authentication guard and D1 persistence
 * - invalidateCacheTagAction purge execution
 * - invalidateTenantCacheAction bulk purge execution
 * - getAssetDeliveryMetricsAction calculation
 * - discoverEdgeEndpointAction edge routing
 *
 * Layer: tree/cdn/__tests__
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import {
  registerThumbnailVariantsAction,
  invalidateCacheTagAction,
  invalidateTenantCacheAction,
  getAssetDeliveryMetricsAction,
  discoverEdgeEndpointAction,
} from '@/land/cdn/cdn-actions';

// Setup mock state for DatabaseSync
let mockSqlite: DatabaseSync;

function createTestD1(): D1Database {
  mockSqlite = new DatabaseSync(':memory:');

  mockSqlite.exec(`
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

    CREATE TABLE IF NOT EXISTS asset_thumbnail_variants (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL CHECK(aspect_ratio IN ('9:16', '16:9', '1:1', '4:5')),
      format TEXT NOT NULL CHECK(format IN ('webp', 'avif', 'jpeg')),
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      size_bytes INTEGER NOT NULL,
      cdn_url TEXT NOT NULL,
      blur_hash TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
      UNIQUE(asset_id, aspect_ratio, format)
    );
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
          const stmt = mockSqlite.prepare(sql);
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
          const stmt = mockSqlite.prepare(sql);
          const results = stmt.all(...params) as T[];
          return { results, meta: { changes: 0, duration: 1 } };
        },
        async first<T = Record<string, unknown>>(...vals: (string | number | null | undefined | bigint)[]) {
          const params = vals.length > 0 ? vals : bound;
          const stmt = mockSqlite.prepare(sql);
          const row = stmt.get(...params);
          return (row as T) ?? null;
        },
      };
    },
  } as unknown as D1Database;
}

let activeD1: D1Database;

let mockCurrentUser: { id: string; email: string; role: string } | null = {
  id: 'usr_admin_123',
  email: 'admin@sophia.agencyos.network',
  role: 'admin',
};

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(async () => mockCurrentUser),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(async () => activeD1),
  getD1Safe: vi.fn(async () => activeD1),
  getD1Raw: vi.fn(async () => activeD1),
}));

describe('CDN Land Actions', () => {
  beforeEach(() => {
    activeD1 = createTestD1();
    mockCurrentUser = {
      id: 'usr_admin_123',
      email: 'admin@sophia.agencyos.network',
      role: 'admin',
    };
  });

  describe('registerThumbnailVariantsAction', () => {
    it('rejects unauthenticated requests with UNAUTHORIZED', async () => {
      mockCurrentUser = null;
      const res = await registerThumbnailVariantsAction({
        assetId: 'a1',
        tenantId: 't1',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('rejects validation errors when assetId or tenantId is missing', async () => {
      const res = await registerThumbnailVariantsAction({
        assetId: '',
        tenantId: 't1',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('generates, persists variants, and registers tag on success', async () => {
      const res = await registerThumbnailVariantsAction({
        assetId: 'asset_action_success',
        tenantId: 'tenant_action_corp',
        aspectRatios: ['9:16', '16:9'],
        formats: ['webp'],
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.count).toBe(2);
        expect(res.value.variants).toHaveLength(2);
      }
    });
  });

  describe('invalidateCacheTagAction', () => {
    it('purges cache tag in D1', async () => {
      // Seed a tag
      await activeD1.prepare(`
        INSERT INTO cdn_edge_cache_tags (id, tag_name, resource_url, asset_type, tenant_id, content_hash, is_purged, created_at)
        VALUES ('id1', 'tag_to_purge_act', 'url', 'thumbnail', 'tenant_1', 'h1', 0, 1000)
      `).run();

      const res = await invalidateCacheTagAction('tag_to_purge_act');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.success).toBe(true);
        expect(res.value.purgedCount).toBe(1);
      }
    });
  });

  describe('invalidateTenantCacheAction', () => {
    it('purges all cache tags for a tenant', async () => {
      await activeD1.prepare(`
        INSERT INTO cdn_edge_cache_tags (id, tag_name, resource_url, asset_type, tenant_id, content_hash, is_purged, created_at)
        VALUES ('id1', 'tag_tenant_1', 'url1', 'thumbnail', 'tenant_purge_tgt', 'h1', 0, 1000),
               ('id2', 'tag_tenant_2', 'url2', 'thumbnail', 'tenant_purge_tgt', 'h2', 0, 1000)
      `).run();

      const res = await invalidateTenantCacheAction('tenant_purge_tgt');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.success).toBe(true);
        expect(res.value.purgedCount).toBe(2);
      }
    });
  });

  describe('getAssetDeliveryMetricsAction', () => {
    it('returns delivery metrics for a tenant', async () => {
      const res = await getAssetDeliveryMetricsAction('tenant_action_corp');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.tenantId).toBe('tenant_action_corp');
        expect(res.value.p95EdgeLatencyMs).toBeLessThan(80);
      }
    });
  });

  describe('discoverEdgeEndpointAction', () => {
    it('discovers nearest POP endpoint for an asset', async () => {
      const res = await discoverEdgeEndpointAction({
        assetId: 'asset_discover_act',
        clientCountry: 'VN',
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.assetId).toBe('asset_discover_act');
        expect(res.value.popColo).toBe('SGN');
        expect(res.value.sub80msSlaMet).toBe(true);
      }
    });
  });
});

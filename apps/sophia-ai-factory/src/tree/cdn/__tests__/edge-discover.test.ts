/**
 * Edge POP Discovery & Route Handler Test Suite
 *
 * Validates:
 * - Haversine distance formula accuracy
 * - Intelligent edge POP routing (direct colo, coordinates, ISO country, region)
 * - Sub-80ms p95 latency guarantee invariant across all global POPs
 * - Edge API route handler (GET /api/cdn/discover) parameter validation,
 *   HTTP status codes (200, 400, 404), and Cloudflare edge response headers
 * - Tenant asset delivery metrics consolidation
 *
 * Layer: tree/cdn/__tests__
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import {
  calculateHaversineDistanceKm,
  resolveNearestPopColo,
  discoverEdgeEndpoint,
  getAssetDeliveryMetrics,
} from '../cache-mesh-service';
import {
  generateThumbnailVariantSpecs,
  saveThumbnailVariants,
} from '../thumbnail-generator';
import { GET } from '@/app/api/cdn/discover/route';
import { EDGE_POP_CATALOG } from '../types';

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

describe('Edge POP Discovery & Discovery Route', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestD1();
  });

  describe('Haversine Distance Accuracy', () => {
    it('computes distance between London and Paris within 1% error margin (~343 km)', () => {
      // London: (51.5074, -0.1278) -> Paris: (48.8566, 2.3522)
      const distance = calculateHaversineDistanceKm(51.5074, -0.1278, 48.8566, 2.3522);
      expect(distance).toBeGreaterThan(340);
      expect(distance).toBeLessThan(346);
    });
  });

  describe('Edge POP Resolution Matrix', () => {
    it('resolves direct client colo code when provided', () => {
      const popSgn = resolveNearestPopColo({ assetId: 'a1', clientColo: 'SGN' });
      expect(popSgn.code).toBe('SGN');
      expect(popSgn.region).toBe('apac');

      const popFra = resolveNearestPopColo({ assetId: 'a1', clientColo: 'FRA' });
      expect(popFra.code).toBe('FRA');
      expect(popFra.region).toBe('eu');
    });

    it('resolves nearest POP by client country', () => {
      expect(resolveNearestPopColo({ assetId: 'a1', clientCountry: 'VN' }).code).toBe('SGN');
      expect(resolveNearestPopColo({ assetId: 'a1', clientCountry: 'SG' }).code).toBe('SIN');
      expect(resolveNearestPopColo({ assetId: 'a1', clientCountry: 'JP' }).code).toBe('NRT');
      expect(resolveNearestPopColo({ assetId: 'a1', clientCountry: 'US' }).code).toBe('SFO');
      expect(resolveNearestPopColo({ assetId: 'a1', clientCountry: 'DE' }).code).toBe('FRA');
      expect(resolveNearestPopColo({ assetId: 'a1', clientCountry: 'GB' }).code).toBe('LHR');
    });

    it('resolves nearest POP by geographical coordinates', () => {
      // Near Ho Chi Minh City: (10.8, 106.6)
      const popHcm = resolveNearestPopColo({
        assetId: 'a1',
        clientCoordinates: { lat: 10.8231, lon: 106.6297 },
      });
      expect(popHcm.code).toBe('SGN');

      // Near Tokyo: (35.6, 139.7)
      const popTokyo = resolveNearestPopColo({
        assetId: 'a1',
        clientCoordinates: { lat: 35.6762, lon: 139.6503 },
      });
      expect(popTokyo.code).toBe('NRT');

      // Near Frankfurt: (50.1, 8.6)
      const popFrankfurt = resolveNearestPopColo({
        assetId: 'a1',
        clientCoordinates: { lat: 50.1109, lon: 8.6821 },
      });
      expect(popFrankfurt.code).toBe('FRA');
    });

    it('falls back to Singapore (SIN) default for undefined hints', () => {
      const fallback = resolveNearestPopColo({ assetId: 'a1' });
      expect(fallback.code).toBe('SIN');
      expect(fallback.region).toBe('apac');
    });
  });

  describe('Sub-80ms p95 Latency Invariant', () => {
    it('verifies all catalog POP base latencies are strictly below 80ms', () => {
      for (const pop of EDGE_POP_CATALOG) {
        expect(pop.baseLatencyMs).toBeLessThan(80);
      }
    });

    it('confirms discovery result satisfies sub80msSlaMet flag', () => {
      const result = discoverEdgeEndpoint({
        assetId: 'asset_speed_test',
        clientCountry: 'VN',
      });

      expect(result.sub80msSlaMet).toBe(true);
      expect(result.estimatedLatencyMs).toBeLessThan(80);
      expect(result.popColo).toBe('SGN');
    });
  });

  describe('Edge Discovery API Route Handler (GET /api/cdn/discover)', () => {
    it('returns 200 with structured JSON and edge headers for valid query', async () => {
      const req = new NextRequest(
        'https://sophia.agencyos.network/api/cdn/discover?assetId=asset_viral_01&aspectRatio=9:16&format=webp',
        {
          headers: {
            'cf-ipcountry': 'VN',
            'x-edge-colo': 'SGN',
          },
        }
      );

      const res = await GET(req);
      expect(res.status).toBe(200);

      // Verify edge headers
      expect(res.headers.get('Cache-Control')).toBe(
        'public, s-maxage=300, stale-while-revalidate=86400'
      );
      expect(res.headers.get('Cache-Tag')).toContain('asset_asset_viral_01');
      expect(res.headers.get('X-Edge-Colo')).toBe('SGN');
      expect(res.headers.get('Server-Timing')).toContain('edge;dur=');

      const body = await res.json() as Record<string, unknown>;
      expect(body.success).toBe(true);
      expect(body.assetId).toBe('asset_viral_01');
      expect(body.popColo).toBe('SGN');
      expect(body.aspectRatio).toBe('9:16');
      expect(body.format).toBe('webp');
      expect(body.sub80msSlaMet).toBe(true);
    });

    it('returns 400 Bad Request when assetId parameter is missing', async () => {
      const req = new NextRequest('https://sophia.agencyos.network/api/cdn/discover');
      const res = await GET(req);
      expect(res.status).toBe(400);

      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toBe('MISSING_ASSET_ID');
    });

    it('returns 400 Bad Request when aspectRatio is invalid', async () => {
      const req = new NextRequest(
        'https://sophia.agencyos.network/api/cdn/discover?assetId=asset_1&aspectRatio=21:9'
      );
      const res = await GET(req);
      expect(res.status).toBe(400);

      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toBe('INVALID_ASPECT_RATIO');
    });

    it('returns 400 Bad Request when format is invalid', async () => {
      const req = new NextRequest(
        'https://sophia.agencyos.network/api/cdn/discover?assetId=asset_1&format=bmp'
      );
      const res = await GET(req);
      expect(res.status).toBe(400);

      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toBe('INVALID_FORMAT');
    });

    it('returns 404 Not Found when asset explicitly missing', async () => {
      const req = new NextRequest(
        'https://sophia.agencyos.network/api/cdn/discover?assetId=missing_asset_999'
      );
      const res = await GET(req);
      expect(res.status).toBe(404);

      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toBe('ASSET_NOT_FOUND');
    });

    it('returns 404 Not Found for arbitrary non-existent asset IDs without prefix dependency', async () => {
      const req = new NextRequest(
        'https://sophia.agencyos.network/api/cdn/discover?assetId=arbitrary_unregistered_asset_777'
      );
      const res = await GET(req);
      expect(res.status).toBe(404);

      const body = await res.json() as Record<string, unknown>;
      expect(body.error).toBe('ASSET_NOT_FOUND');
      expect(body.message).toContain('arbitrary_unregistered_asset_777');
    });
  });

  describe('Asset Delivery Metrics Consolidation', () => {
    it('computes metrics from variant counts and cache tag records', async () => {
      // Seed thumbnail variants
      const variants = generateThumbnailVariantSpecs({
        assetId: 'asset_metrics_test',
        tenantId: 'tenant_metric_corp',
        aspectRatios: ['9:16', '16:9'],
        formats: ['webp', 'avif'],
      });
      await saveThumbnailVariants(db, variants);

      // Seed cache tags: 3 active, 1 purged
      const now = Date.now();
      await db.prepare(`
        INSERT INTO cdn_edge_cache_tags (id, tag_name, resource_url, asset_type, tenant_id, content_hash, is_purged, purged_at, created_at)
        VALUES ('t1', 'tag1', 'url1', 'thumbnail', 'tenant_metric_corp', 'h1', 0, NULL, ?),
               ('t2', 'tag2', 'url2', 'thumbnail', 'tenant_metric_corp', 'h2', 0, NULL, ?),
               ('t3', 'tag3', 'url3', 'thumbnail', 'tenant_metric_corp', 'h3', 0, NULL, ?),
               ('t4', 'tag4', 'url4', 'thumbnail', 'tenant_metric_corp', 'h4', 1, ?, ?)
      `).bind(now, now, now, now, now).run();

      const metrics = await getAssetDeliveryMetrics(db, 'tenant_metric_corp');

      expect(metrics.tenantId).toBe('tenant_metric_corp');
      expect(metrics.totalVariantsCount).toBe(4);
      expect(metrics.activeCacheTagsCount).toBe(3);
      expect(metrics.purgedTagsCount).toBe(1);
      expect(metrics.lastPurgedAt).toBe(now);
      expect(metrics.estimatedBandwidthSavedBytes).toBeGreaterThan(0);
      expect(metrics.estimatedCacheHitRatePct).toBeGreaterThan(95);
      expect(metrics.p95EdgeLatencyMs).toBeLessThan(80);
    });
  });
});

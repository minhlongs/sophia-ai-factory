/**
 * Thumbnail Generator & Multi-Aspect-Ratio Engine Test Suite
 *
 * Validates:
 * - Multi-aspect-ratio calculations: 9:16 (1080x1920), 16:9 (1920x1080), 1:1 (1080x1080), 4:5 (1080x1350)
 * - Centered crop and scale geometry calculations
 * - Payload size estimation and format compression ratios (AVIF ~38% smaller than WebP)
 * - BlurHash Base83 generation, determinism, and format validation
 * - D1 thumbnail variants synchronization with node:sqlite DatabaseSync(':memory:')
 *
 * Layer: tree/cdn/__tests__
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import {
  getDimensionsForAspectRatio,
  isValidAspectRatio,
  isValidThumbnailFormat,
  calculateCropAndScale,
  calculateEstimatedSizeBytes,
  encodeBase83,
  decodeBase83,
  generateBlurHash,
  isValidBlurHash,
  generateThumbnailVariantSpecs,
  saveThumbnailVariants,
  getThumbnailVariantsByAsset,
  selectOptimalVariant,
} from '../thumbnail-generator';
import type { AspectRatio } from '../types';

function createTestD1(): D1Database {
  const sqlite = new DatabaseSync(':memory:');

  sqlite.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_thumb_asset ON asset_thumbnail_variants(asset_id, aspect_ratio);
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

describe('Thumbnail Generator & Multi-Aspect-Ratio Engine', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createTestD1();
  });

  describe('Aspect Ratio Dimensions', () => {
    it('computes exact High, Standard, and Preview dimensions for all 4 aspect ratios', () => {
      // 9:16 (Vertical Video: Shorts, TikTok, Reels)
      expect(getDimensionsForAspectRatio('9:16', 'high')).toEqual({ width: 1080, height: 1920 });
      expect(getDimensionsForAspectRatio('9:16', 'standard')).toEqual({ width: 540, height: 960 });
      expect(getDimensionsForAspectRatio('9:16', 'preview')).toEqual({ width: 270, height: 480 });

      // 16:9 (Landscape: YouTube, Web)
      expect(getDimensionsForAspectRatio('16:9', 'high')).toEqual({ width: 1920, height: 1080 });
      expect(getDimensionsForAspectRatio('16:9', 'standard')).toEqual({ width: 1280, height: 720 });
      expect(getDimensionsForAspectRatio('16:9', 'preview')).toEqual({ width: 640, height: 360 });

      // 1:1 (Square: Feed, Carousels)
      expect(getDimensionsForAspectRatio('1:1', 'high')).toEqual({ width: 1080, height: 1080 });
      expect(getDimensionsForAspectRatio('1:1', 'standard')).toEqual({ width: 600, height: 600 });
      expect(getDimensionsForAspectRatio('1:1', 'preview')).toEqual({ width: 300, height: 300 });

      // 4:5 (Portrait: Instagram Feed)
      expect(getDimensionsForAspectRatio('4:5', 'high')).toEqual({ width: 1080, height: 1350 });
      expect(getDimensionsForAspectRatio('4:5', 'standard')).toEqual({ width: 720, height: 900 });
      expect(getDimensionsForAspectRatio('4:5', 'preview')).toEqual({ width: 360, height: 450 });
    });

    it('validates aspect ratio strings accurately', () => {
      expect(isValidAspectRatio('9:16')).toBe(true);
      expect(isValidAspectRatio('16:9')).toBe(true);
      expect(isValidAspectRatio('1:1')).toBe(true);
      expect(isValidAspectRatio('4:5')).toBe(true);
      expect(isValidAspectRatio('21:9')).toBe(false);
      expect(isValidAspectRatio('invalid')).toBe(false);
    });

    it('validates thumbnail formats accurately', () => {
      expect(isValidThumbnailFormat('webp')).toBe(true);
      expect(isValidThumbnailFormat('avif')).toBe(true);
      expect(isValidThumbnailFormat('jpeg')).toBe(true);
      expect(isValidThumbnailFormat('png')).toBe(false);
    });
  });

  describe('Centered Crop and Scale Geometry', () => {
    it('calculates horizontal centered crop when converting 16:9 input to 9:16 target', () => {
      // Input: 1920x1080 (16:9 landscape) -> Target: 9:16 vertical
      const geom = calculateCropAndScale(1920, 1080, '9:16');
      expect(geom.cropHeight).toBe(1080);
      expect(geom.cropWidth).toBe(Math.round(1080 * (9 / 16))); // 608px
      expect(geom.cropX).toBe(Math.round((1920 - 608) / 2)); // Centered horizontally
      expect(geom.cropY).toBe(0);
      expect(geom.targetWidth).toBe(1080);
      expect(geom.targetHeight).toBe(1920);
    });

    it('calculates vertical centered crop when converting 9:16 input to 16:9 target', () => {
      // Input: 1080x1920 (9:16 vertical) -> Target: 16:9 landscape
      const geom = calculateCropAndScale(1080, 1920, '16:9');
      expect(geom.cropWidth).toBe(1080);
      expect(geom.cropHeight).toBe(Math.round(1080 / (16 / 9))); // 608px
      expect(geom.cropX).toBe(0);
      expect(geom.cropY).toBe(Math.round((1920 - 608) / 2)); // Centered vertically
    });

    it('preserves full frame when input aspect ratio matches target', () => {
      const geom = calculateCropAndScale(1080, 1080, '1:1');
      expect(geom.cropX).toBe(0);
      expect(geom.cropY).toBe(0);
      expect(geom.cropWidth).toBe(1080);
      expect(geom.cropHeight).toBe(1080);
    });

    it('guards against zero, negative, and non-finite dimensions without Infinity scaleFactor', () => {
      // Zero dimensions
      const geomZero = calculateCropAndScale(0, 0, '9:16');
      expect(geomZero.scaleFactor).toBe(1.0);
      expect(geomZero.scaleFactor).not.toBe(Infinity);
      expect(geomZero.cropWidth).toBeGreaterThan(0);
      expect(geomZero.cropHeight).toBeGreaterThan(0);

      // Negative dimensions
      const geomNeg = calculateCropAndScale(-500, -200, '16:9');
      expect(geomNeg.scaleFactor).toBe(1.0);
      expect(geomNeg.cropWidth).toBeGreaterThan(0);

      // NaN dimensions
      const geomNan = calculateCropAndScale(NaN, 1080, '1:1');
      expect(geomNan.scaleFactor).toBe(1.0);
    });
  });

  describe('Compression & Size Estimations', () => {
    it('demonstrates AVIF achieves ~38% smaller payload than WebP at equivalent dimensions', () => {
      const width = 1080;
      const height = 1920;

      const webpBytes = calculateEstimatedSizeBytes(width, height, 'webp');
      const avifBytes = calculateEstimatedSizeBytes(width, height, 'avif');
      const jpegBytes = calculateEstimatedSizeBytes(width, height, 'jpeg');

      // WebP should be smaller than JPEG
      expect(webpBytes).toBeLessThan(jpegBytes);
      // AVIF should be smaller than WebP
      expect(avifBytes).toBeLessThan(webpBytes);

      // Verify ~38% reduction ratio (0.05 / 0.08 * (75/80) / (82/80) ~ 38% reduction)
      const reductionPct = ((webpBytes - avifBytes) / webpBytes) * 100;
      expect(reductionPct).toBeGreaterThan(30);
      expect(reductionPct).toBeLessThan(45);
    });
  });

  describe('BlurHash Base83 & Placeholder Generation', () => {
    it('encodes and decodes Base83 values accurately', () => {
      const original = 12345;
      const encoded = encodeBase83(original, 4);
      expect(encoded).toHaveLength(4);
      const decoded = decodeBase83(encoded);
      expect(decoded).toBe(original);
    });

    it('generates a valid, compact 4x3 BlurHash string', () => {
      const hash = generateBlurHash('asset_video_001', '9:16');
      expect(typeof hash).toBe('string');
      // 4x3 components -> 28 characters
      expect(hash).toHaveLength(28);
      // First character encodes 4x3 components (sizeFlag = 21 -> 'L')
      expect(hash[0]).toBe('L');
      // Must pass format validation
      expect(isValidBlurHash(hash)).toBe(true);
    });

    it('guarantees deterministic output for identical asset inputs', () => {
      const hash1 = generateBlurHash('asset_demo_abc', '16:9');
      const hash2 = generateBlurHash('asset_demo_abc', '16:9');
      expect(hash1).toBe(hash2);

      const hashDifferentRatio = generateBlurHash('asset_demo_abc', '1:1');
      expect(hashDifferentRatio).not.toBe(hash1);
    });

    it('rejects malformed BlurHash strings', () => {
      expect(isValidBlurHash('')).toBe(false);
      expect(isValidBlurHash('invalid!')).toBe(false);
      expect(isValidBlurHash('too_short')).toBe(false);
      // Valid chars but wrong component count length
      expect(isValidBlurHash('L123456789012345')).toBe(false);
    });
  });

  describe('D1 Thumbnail Variants Persistence & Selection', () => {
    it('generates and persists thumbnail variants across all 4 ratios and formats', async () => {
      const ratios: AspectRatio[] = ['9:16', '16:9', '1:1', '4:5'];
      const variants = generateThumbnailVariantSpecs({
        assetId: 'asset_product_launch',
        tenantId: 'tenant_agency_x',
        aspectRatios: ratios,
        formats: ['webp', 'avif'],
      });

      // 4 ratios * 2 formats = 8 variants
      expect(variants).toHaveLength(8);

      const insertedCount = await saveThumbnailVariants(db, variants);
      expect(insertedCount).toBe(8);

      const fetched = await getThumbnailVariantsByAsset(db, 'asset_product_launch');
      expect(fetched).toHaveLength(8);
      expect(fetched[0]!.assetId).toBe('asset_product_launch');
      expect(fetched[0]!.tenantId).toBe('tenant_agency_x');
    });

    it('enforces UNIQUE(asset_id, aspect_ratio, format) with idempotent upsert', async () => {
      const variant1 = generateThumbnailVariantSpecs({
        assetId: 'asset_idempotent_test',
        tenantId: 'tenant_1',
        aspectRatios: ['9:16'],
        formats: ['webp'],
      });

      await saveThumbnailVariants(db, variant1);
      expect(await getThumbnailVariantsByAsset(db, 'asset_idempotent_test')).toHaveLength(1);

      // Re-inserting with updated cdnBaseUrl
      const variantUpdated = generateThumbnailVariantSpecs({
        assetId: 'asset_idempotent_test',
        tenantId: 'tenant_1',
        aspectRatios: ['9:16'],
        formats: ['webp'],
        cdnBaseUrl: 'https://cdn-alt.sophia.network',
      });

      await saveThumbnailVariants(db, variantUpdated);
      const afterUpsert = await getThumbnailVariantsByAsset(db, 'asset_idempotent_test');
      expect(afterUpsert).toHaveLength(1);
      expect(afterUpsert[0]!.cdnUrl).toContain('cdn-alt.sophia.network');
    });

    it('selects optimal variant matching preferences and fallbacks', () => {
      const variants = generateThumbnailVariantSpecs({
        assetId: 'asset_selection_test',
        tenantId: 'tenant_1',
        aspectRatios: ['9:16', '16:9'],
        formats: ['webp', 'avif'],
      });

      // Exact match
      const exact = selectOptimalVariant(variants, '9:16', 'avif');
      expect(exact?.aspectRatio).toBe('9:16');
      expect(exact?.format).toBe('avif');

      // Ratio match with fallback format (request jpeg, get avif preference)
      const fallbackFormat = selectOptimalVariant(variants, '16:9', 'jpeg');
      expect(fallbackFormat?.aspectRatio).toBe('16:9');
      expect(fallbackFormat?.format).toBe('avif');

      // Empty variants list
      expect(selectOptimalVariant([])).toBeNull();
    });
  });
});

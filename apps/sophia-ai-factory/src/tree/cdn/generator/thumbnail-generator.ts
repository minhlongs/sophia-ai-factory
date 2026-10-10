/**
 * Thumbnail variant specifications generator and D1 database repository.
 *
 * @module tree/cdn/generator/thumbnail-generator
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AspectRatio,
  ThumbnailFormat,
  AssetThumbnailVariant,
  AssetThumbnailVariantRow,
  GenerateVariantsInput,
} from '@/tree/cdn/types';
import {
  ASPECT_RATIOS,
  mapRowToThumbnailVariant,
} from '@/tree/cdn/types';
import { getDimensionsForAspectRatio } from './canvas-renderer';
import { generateBlurHash, calculateEstimatedSizeBytes } from './image-compressor';

/**
 * Generates thumbnail variant records for an asset across aspect ratios and formats.
 */
export function generateThumbnailVariantSpecs(
  input: GenerateVariantsInput,
): AssetThumbnailVariant[] {
  const ratios = input.aspectRatios ?? ASPECT_RATIOS;
  const formats = input.formats ?? ['webp', 'avif'];
  const baseUrl = input.cdnBaseUrl ?? 'https://cdn.sophia.agencyos.network';
  const now = Date.now();

  const variants: AssetThumbnailVariant[] = [];

  for (const ratio of ratios) {
    const dims = getDimensionsForAspectRatio(ratio, 'high');
    const blurHash = input.customBlurHash ?? generateBlurHash(input.assetId, ratio);

    for (const fmt of formats) {
      const sizeBytes = calculateEstimatedSizeBytes(dims.width, dims.height, fmt);
      const ratioSlug = ratio.replace(':', 'x');
      const cdnUrl = `${baseUrl}/assets/${input.tenantId}/${input.assetId}/thumb_${ratioSlug}_${dims.width}x${dims.height}.${fmt}`;

      variants.push({
        id: `th_${crypto.randomUUID()}`,
        assetId: input.assetId,
        tenantId: input.tenantId,
        aspectRatio: ratio,
        format: fmt,
        width: dims.width,
        height: dims.height,
        sizeBytes,
        cdnUrl,
        blurHash,
        createdAt: now,
      });
    }
  }

  return variants;
}

/**
 * Saves thumbnail variant specifications into D1 database.
 * Uses INSERT OR REPLACE to uphold the UNIQUE(asset_id, aspect_ratio, format) constraint.
 */
export async function saveThumbnailVariants(
  db: D1Database,
  variants: AssetThumbnailVariant[],
): Promise<number> {
  if (variants.length === 0) return 0;

  const sql = `
    INSERT OR REPLACE INTO asset_thumbnail_variants (
      id, asset_id, tenant_id, aspect_ratio, format,
      width, height, size_bytes, cdn_url, blur_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  let inserted = 0;
  for (const v of variants) {
    await db
      .prepare(sql)
      .bind(
        v.id,
        v.assetId,
        v.tenantId,
        v.aspectRatio,
        v.format,
        v.width,
        v.height,
        v.sizeBytes,
        v.cdnUrl,
        v.blurHash,
        v.createdAt,
      )
      .run();
    inserted++;
  }

  logger.info('Saved thumbnail variants to D1', {
    assetId: variants[0]?.assetId,
    count: inserted,
  });

  return inserted;
}

/**
 * Retrieves all registered thumbnail variants for an asset.
 */
export async function getThumbnailVariantsByAsset(
  db: D1Database,
  assetId: string,
): Promise<AssetThumbnailVariant[]> {
  const sql = `
    SELECT id, asset_id, tenant_id, aspect_ratio, format,
           width, height, size_bytes, cdn_url, blur_hash, created_at
    FROM asset_thumbnail_variants
    WHERE asset_id = ?
    ORDER BY width DESC, format ASC
  `;

  const result = await db.prepare(sql).bind(assetId).all<AssetThumbnailVariantRow>();
  const rows = result.results ?? [];
  return rows.map(mapRowToThumbnailVariant);
}

/**
 * Finds the optimal variant matching preferred aspect ratio and format.
 */
export function selectOptimalVariant(
  variants: AssetThumbnailVariant[],
  preferredRatio: AspectRatio = '9:16',
  preferredFormat: ThumbnailFormat = 'webp',
): AssetThumbnailVariant | null {
  if (variants.length === 0) return null;

  // 1. Exact match on ratio & format
  const exact = variants.find(
    (v) => v.aspectRatio === preferredRatio && v.format === preferredFormat,
  );
  if (exact) return exact;

  // 2. Match ratio with any format (prefer AVIF -> WebP -> JPEG)
  const ratioMatches = variants.filter((v) => v.aspectRatio === preferredRatio);
  if (ratioMatches.length > 0) {
    const avif = ratioMatches.find((v) => v.format === 'avif');
    if (avif) return avif;
    const webp = ratioMatches.find((v) => v.format === 'webp');
    if (webp) return webp;
    return ratioMatches[0]!;
  }

  // 3. Fallback to first available
  return variants[0] ?? null;
}

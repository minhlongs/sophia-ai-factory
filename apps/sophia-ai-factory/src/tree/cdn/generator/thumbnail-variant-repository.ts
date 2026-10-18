/**
 * D1 Repository for Asset Thumbnail Variants
 *
 * @module tree/cdn/generator/thumbnail-variant-repository
 */

import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AssetThumbnailVariant,
  AssetThumbnailVariantRow,
} from '@/tree/cdn/types';
import { mapRowToThumbnailVariant } from '@/tree/cdn/types';

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

/**
 * Global Edge CDN Mesh — Thumbnail Variants
 *
 * Layer: tree/cdn/types
 */

import type { AspectRatio, ThumbnailFormat } from './presets';

export interface AssetThumbnailVariant {
  id: string;
  assetId: string;
  tenantId: string;
  aspectRatio: AspectRatio;
  format: ThumbnailFormat;
  width: number;
  height: number;
  sizeBytes: number;
  cdnUrl: string;
  blurHash: string | null;
  createdAt: number;
}

export interface AssetThumbnailVariantRow {
  id: string;
  asset_id: string;
  tenant_id: string;
  aspect_ratio: string;
  format: string;
  width: number;
  height: number;
  size_bytes: number;
  cdn_url: string;
  blur_hash: string | null;
  created_at: number;
}

export interface GenerateVariantsInput {
  assetId: string;
  tenantId: string;
  sourceWidth?: number;
  sourceHeight?: number;
  cdnBaseUrl?: string;
  formats?: ThumbnailFormat[];
  aspectRatios?: AspectRatio[];
  customBlurHash?: string;
}

export function mapRowToThumbnailVariant(row: AssetThumbnailVariantRow): AssetThumbnailVariant {
  return {
    id: row.id,
    assetId: row.asset_id,
    tenantId: row.tenant_id,
    aspectRatio: row.aspect_ratio as AspectRatio,
    format: row.format as ThumbnailFormat,
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    cdnUrl: row.cdn_url,
    blurHash: row.blur_hash,
    createdAt: row.created_at,
  };
}

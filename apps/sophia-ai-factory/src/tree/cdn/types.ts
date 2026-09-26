/**
 * Global Edge CDN Mesh & Asset Acceleration Types
 *
 * Layer: tree/cdn (Pure domain types and contracts)
 * Dependencies: seed only
 */

export type AssetType = 'video' | 'thumbnail' | 'template' | 'preview' | 'hls_manifest';

export type AspectRatio = '9:16' | '16:9' | '1:1' | '4:5';

export type ThumbnailFormat = 'webp' | 'avif' | 'jpeg';

export type ThumbnailResolutionTier = 'high' | 'standard' | 'preview';

export interface DimensionSpec {
  width: number;
  height: number;
  tier: ThumbnailResolutionTier;
}

export interface CdnEdgeCacheTag {
  id: string;
  tagName: string;
  resourceUrl: string;
  assetType: AssetType;
  tenantId: string;
  contentHash: string;
  edgeTtlSeconds: number;
  staleWhileRevalidateSeconds: number;
  isPurged: boolean;
  purgedAt: number | null;
  createdAt: number;
}

export interface CdnEdgeCacheTagRow {
  id: string;
  tag_name: string;
  resource_url: string;
  asset_type: string;
  tenant_id: string;
  content_hash: string;
  edge_ttl_seconds: number;
  stale_while_revalidate_seconds: number;
  is_purged: number;
  purged_at: number | null;
  created_at: number;
}

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

export interface CacheControlConfig {
  scope?: 'public' | 'private';
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  immutable?: boolean;
  noTransform?: boolean;
}

export interface PopColo {
  code: string;
  city: string;
  country: string;
  region: 'apac' | 'us' | 'eu';
  coordinates: {
    lat: number;
    lon: number;
  };
  baseLatencyMs: number;
}

export interface EdgeDiscoverQuery {
  assetId: string;
  aspectRatio?: AspectRatio;
  format?: ThumbnailFormat;
  tenantId?: string;
  preferredRegion?: string;
  clientCountry?: string;
  clientColo?: string;
  clientCoordinates?: {
    lat: number;
    lon: number;
  };
}

export interface EdgeDiscoverResult {
  assetId: string;
  cdnUrl: string;
  aspectRatio: AspectRatio;
  format: ThumbnailFormat;
  popColo: string;
  region: string;
  estimatedLatencyMs: number;
  cacheStatus: 'HIT' | 'MISS';
  sub80msSlaMet: boolean;
  headers: Record<string, string>;
  variant?: AssetThumbnailVariant;
}

export interface PurgeTagResult {
  success: boolean;
  tagName: string;
  purgedCount: number;
  kvVersion: number;
  timestamp: number;
  error?: string;
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

export interface AssetDeliveryMetrics {
  tenantId: string;
  totalVariantsCount: number;
  activeCacheTagsCount: number;
  purgedTagsCount: number;
  estimatedBandwidthSavedBytes: number;
  estimatedCacheHitRatePct: number;
  p95EdgeLatencyMs: number;
  lastPurgedAt: number | null;
}

export const ASSET_TYPES: readonly AssetType[] = [
  'video',
  'thumbnail',
  'template',
  'preview',
  'hls_manifest',
] as const;

export const ASPECT_RATIOS: readonly AspectRatio[] = [
  '9:16',
  '16:9',
  '1:1',
  '4:5',
] as const;

export const THUMBNAIL_FORMATS: readonly ThumbnailFormat[] = [
  'webp',
  'avif',
  'jpeg',
] as const;

export const ASPECT_RATIO_PRESETS: Record<
  AspectRatio,
  Record<ThumbnailResolutionTier, { width: number; height: number }>
> = {
  '9:16': {
    high: { width: 1080, height: 1920 },
    standard: { width: 540, height: 960 },
    preview: { width: 270, height: 480 },
  },
  '16:9': {
    high: { width: 1920, height: 1080 },
    standard: { width: 1280, height: 720 },
    preview: { width: 640, height: 360 },
  },
  '1:1': {
    high: { width: 1080, height: 1080 },
    standard: { width: 600, height: 600 },
    preview: { width: 300, height: 300 },
  },
  '4:5': {
    high: { width: 1080, height: 1350 },
    standard: { width: 720, height: 900 },
    preview: { width: 360, height: 450 },
  },
};

export const EDGE_POP_CATALOG: readonly PopColo[] = [
  // APAC
  { code: 'SGN', city: 'Ho Chi Minh City', country: 'VN', region: 'apac', coordinates: { lat: 10.8231, lon: 106.6297 }, baseLatencyMs: 22 },
  { code: 'HAN', city: 'Hanoi', country: 'VN', region: 'apac', coordinates: { lat: 21.0285, lon: 105.8542 }, baseLatencyMs: 24 },
  { code: 'SIN', city: 'Singapore', country: 'SG', region: 'apac', coordinates: { lat: 1.3521, lon: 103.8198 }, baseLatencyMs: 32 },
  { code: 'NRT', city: 'Tokyo', country: 'JP', region: 'apac', coordinates: { lat: 35.7720, lon: 140.3929 }, baseLatencyMs: 48 },
  { code: 'HKG', city: 'Hong Kong', country: 'HK', region: 'apac', coordinates: { lat: 22.3193, lon: 114.1694 }, baseLatencyMs: 38 },
  // US
  { code: 'SFO', city: 'San Francisco', country: 'US', region: 'us', coordinates: { lat: 37.7749, lon: -122.4194 }, baseLatencyMs: 35 },
  { code: 'IAD', city: 'Washington DC', country: 'US', region: 'us', coordinates: { lat: 38.9531, lon: -77.4565 }, baseLatencyMs: 42 },
  // EU
  { code: 'FRA', city: 'Frankfurt', country: 'DE', region: 'eu', coordinates: { lat: 50.1109, lon: 8.6821 }, baseLatencyMs: 36 },
  { code: 'LHR', city: 'London', country: 'GB', region: 'eu', coordinates: { lat: 51.5074, lon: -0.1278 }, baseLatencyMs: 40 },
] as const;

export function mapRowToCacheTag(row: CdnEdgeCacheTagRow): CdnEdgeCacheTag {
  return {
    id: row.id,
    tagName: row.tag_name,
    resourceUrl: row.resource_url,
    assetType: row.asset_type as AssetType,
    tenantId: row.tenant_id,
    contentHash: row.content_hash,
    edgeTtlSeconds: row.edge_ttl_seconds,
    staleWhileRevalidateSeconds: row.stale_while_revalidate_seconds,
    isPurged: row.is_purged === 1,
    purgedAt: row.purged_at,
    createdAt: row.created_at,
  };
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

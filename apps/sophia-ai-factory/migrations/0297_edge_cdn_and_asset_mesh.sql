-- Migration 0297: Global Edge CDN Mesh & Asset Acceleration
-- Milestone: APAC Multi-Language Video, Creator Marketplace & Global CDN Mesh ($400k MRR)
-- Supports Pillar R4: Global Edge CDN Video Caching, Adaptive HLS Streaming & Asset Mesh

-- ============================================================================
-- 1. CDN EDGE CACHE TAGS TABLE
-- Tracks edge-cacheable tags, associated resource URLs, asset types and purge status
-- for granular Cloudflare Cache-Tag invalidation.
-- ============================================================================
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
CREATE INDEX IF NOT EXISTS idx_cdn_asset_type ON cdn_edge_cache_tags(asset_type);

-- ============================================================================
-- 2. ASSET THUMBNAIL VARIANTS TABLE
-- Pre-calculated multi-aspect-ratio (9:16, 16:9, 1:1, 4:5) image variants in WebP/AVIF/JPEG
-- with BlurHash low-latency progressive rendering placeholders.
-- ============================================================================
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
CREATE INDEX IF NOT EXISTS idx_thumb_tenant ON asset_thumbnail_variants(tenant_id);

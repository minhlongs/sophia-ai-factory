/**
 * Global Edge CDN Mesh — Cache Tags & Header Types
 *
 * Layer: tree/cdn/types
 */

import type { AssetType } from './presets';

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

export interface CacheControlConfig {
  scope?: 'public' | 'private';
  maxAge?: number;
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  staleIfError?: number;
  immutable?: boolean;
  noTransform?: boolean;
}

export interface PurgeTagResult {
  success: boolean;
  tagName: string;
  purgedCount: number;
  kvVersion: number;
  timestamp: number;
  error?: string;
}

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

/**
 * CDN Cache Control & HTTP Header Generators
 * Layer: tree/cdn
 *
 * @module tree/cdn/mesh/header-generators
 */

import type { AssetType, CacheControlConfig } from '@/tree/cdn/types';

/**
 * Builds standard Cache-Control header based on configuration.
 */
export function buildCacheControlHeader(config: CacheControlConfig = {}): string {
  const directives: string[] = [];

  const scope = config.scope ?? 'public';
  directives.push(scope);

  if (config.sMaxAge !== undefined) {
    directives.push(`s-maxage=${Math.max(0, Math.floor(config.sMaxAge))}`);
  }

  if (config.maxAge !== undefined) {
    directives.push(`max-age=${Math.max(0, Math.floor(config.maxAge))}`);
  }

  if (config.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${Math.max(0, Math.floor(config.staleWhileRevalidate))}`);
  }

  if (config.staleIfError !== undefined) {
    directives.push(`stale-if-error=${Math.max(0, Math.floor(config.staleIfError))}`);
  }

  if (config.immutable) {
    directives.push('immutable');
  }

  if (config.noTransform) {
    directives.push('no-transform');
  }

  return directives.join(', ');
}

/**
 * Dynamic HLS manifests cache control:
 * public, s-maxage=60, stale-while-revalidate=300
 */
export function getHlsManifestCacheControl(): string {
  return 'public, s-maxage=60, stale-while-revalidate=300';
}

/**
 * Static fingerprinted video chunks (.ts / .m4s):
 * public, max-age=31536000, immutable
 */
export function getStaticChunkCacheControl(): string {
  return 'public, max-age=31536000, immutable';
}

/**
 * Edge discovery API cache control:
 * public, s-maxage=300, stale-while-revalidate=86400
 */
export function getEdgeDiscoveryCacheControl(): string {
  return 'public, s-maxage=300, stale-while-revalidate=86400';
}

/**
 * Canonical Cache-Control resolution per asset type.
 */
export function getCacheControlForAssetType(assetType: AssetType): string {
  switch (assetType) {
    case 'hls_manifest':
      return getHlsManifestCacheControl();
    case 'video':
      return getStaticChunkCacheControl();
    case 'thumbnail':
      return 'public, max-age=2592000, s-maxage=86400, stale-while-revalidate=604800';
    case 'preview':
      return 'public, max-age=86400, s-maxage=3600, stale-while-revalidate=86400';
    case 'template':
      return 'public, max-age=3600, s-maxage=1800, stale-while-revalidate=86400';
    default:
      return 'public, max-age=3600, stale-while-revalidate=86400';
  }
}

/**
 * Synthesizes Cloudflare Cache-Tag header for atomic purges.
 * Formats tags into clean comma-separated tokens.
 */
export function buildCacheTagHeader(params: {
  assetId?: string;
  templateId?: string;
  tenantId?: string;
  assetType?: AssetType;
  customTags?: string[];
}): string {
  const tags: string[] = [];

  const rawTemplate = params.templateId || params.assetId;
  if (rawTemplate) {
    const cleanId = rawTemplate.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    tags.push(`template_${cleanId}`);
    tags.push(`asset_${cleanId}`);
  }

  if (params.tenantId) {
    const cleanTenant = params.tenantId.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    tags.push(`tenant_${cleanTenant}`);
  }

  if (params.assetType) {
    tags.push(`type_${params.assetType}`);
  }

  if (params.customTags && params.customTags.length > 0) {
    for (const tag of params.customTags) {
      const clean = tag.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      if (clean && !tags.includes(clean)) {
        tags.push(clean);
      }
    }
  }

  return tags.join(', ');
}

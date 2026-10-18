/**
 * Edge Endpoint Discovery & Metrics Engine
 * Layer: tree/cdn
 *
 * @module tree/cdn/mesh/discovery-metrics-engine
 */

import type {
  AspectRatio,
  ThumbnailFormat,
  EdgeDiscoverQuery,
  EdgeDiscoverResult,
  AssetThumbnailVariant,
} from '@/tree/cdn/types';
import { ASPECT_RATIO_PRESETS } from '@/tree/cdn/types';
import {
  getEdgeDiscoveryCacheControl,
  buildCacheTagHeader,
} from './header-generators';
import {
  calculateHaversineDistanceKm,
  resolveNearestPopColo,
} from './pop-resolver';
import { getAssetDeliveryMetrics } from './delivery-metrics-query';

export { getAssetDeliveryMetrics };

/**
 * Executes edge discovery: determines nearest POP, constructs edge CDN URL,
 * validates sub-80ms p95 latency target, and prepares edge caching headers.
 */
export function discoverEdgeEndpoint(
  query: EdgeDiscoverQuery,
  variants: AssetThumbnailVariant[] = []
): EdgeDiscoverResult {
  const pop = resolveNearestPopColo(query);
  const preferredRatio: AspectRatio = query.aspectRatio ?? '9:16';
  const preferredFormat: ThumbnailFormat = query.format ?? 'webp';

  let estimatedLatencyMs = pop.baseLatencyMs;
  if (query.clientCoordinates) {
    const dist = calculateHaversineDistanceKm(
      query.clientCoordinates.lat,
      query.clientCoordinates.lon,
      pop.coordinates.lat,
      pop.coordinates.lon
    );
    const extraLatency = Math.min(30, Math.round((dist / 1000) * 5));
    estimatedLatencyMs += extraLatency;
  }

  const sub80msSlaMet = estimatedLatencyMs < 80;

  const matchedVariant = variants.find(
    (v) => v.aspectRatio === preferredRatio && v.format === preferredFormat
  ) ?? variants.find((v) => v.aspectRatio === preferredRatio) ?? variants[0];

  let cdnUrl = matchedVariant?.cdnUrl;
  if (!cdnUrl) {
    const dims = ASPECT_RATIO_PRESETS[preferredRatio].high;
    const ratioSlug = preferredRatio.replace(':', 'x');
    const tenant = query.tenantId ?? 'default';
    cdnUrl = `https://cdn.sophia.agencyos.network/assets/${tenant}/${query.assetId}/thumb_${ratioSlug}_${dims.width}x${dims.height}.${preferredFormat}`;
  }

  const cacheStatus: 'HIT' | 'MISS' = variants.length > 0 ? 'HIT' : 'MISS';
  const edgeDuration = Math.round(estimatedLatencyMs * 0.4);
  const dbDuration = Math.round(estimatedLatencyMs * 0.6);

  const headers: Record<string, string> = {
    'Cache-Control': getEdgeDiscoveryCacheControl(),
    'Cache-Tag': buildCacheTagHeader({
      assetId: query.assetId,
      tenantId: query.tenantId,
      assetType: 'thumbnail',
      customTags: ['cdn_discover', `colo_${pop.code.toLowerCase()}`],
    }),
    'X-Edge-Colo': pop.code,
    'CF-Cache-Status': cacheStatus,
    'Server-Timing': `edge;dur=${edgeDuration}, db;dur=${dbDuration}`,
  };

  return {
    assetId: query.assetId,
    cdnUrl,
    aspectRatio: preferredRatio,
    format: preferredFormat,
    popColo: pop.code,
    region: pop.region,
    estimatedLatencyMs,
    cacheStatus,
    sub80msSlaMet,
    headers,
    variant: matchedVariant,
  };
}

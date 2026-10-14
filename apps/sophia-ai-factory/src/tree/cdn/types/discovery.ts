/**
 * Global Edge CDN Mesh — Edge PoP Catalog, Discovery & Metrics
 *
 * Layer: tree/cdn/types
 */

import type { AspectRatio, ThumbnailFormat } from './presets';
import type { AssetThumbnailVariant } from './variants';

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

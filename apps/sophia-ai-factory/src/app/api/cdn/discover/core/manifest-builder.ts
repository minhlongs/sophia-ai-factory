import { NextResponse } from 'next/server';
import type { AssetThumbnailVariant, EdgeDiscoverQuery } from '@/tree/cdn/types';
import { discoverEdgeEndpoint } from '@/tree/cdn/cache-mesh-service';
import type { ValidatedParams, EdgeHints } from './types';

export function buildDiscoveryResponse(
  validated: ValidatedParams,
  edgeHints: EdgeHints,
  dbVariants: AssetThumbnailVariant[],
): NextResponse {
  const query: EdgeDiscoverQuery = {
    assetId: validated.assetId,
    aspectRatio: validated.preferredRatio,
    format: validated.preferredFormat,
    tenantId: validated.tenantId,
    preferredRegion: validated.preferredRegion,
    clientCountry: edgeHints.country,
    clientColo: edgeHints.colo,
    clientCoordinates: edgeHints.coordinates,
  };

  const discovery = discoverEdgeEndpoint(query, dbVariants);

  const response = NextResponse.json(
    {
      success: true,
      assetId: discovery.assetId,
      cdnUrl: discovery.cdnUrl,
      aspectRatio: discovery.aspectRatio,
      format: discovery.format,
      popColo: discovery.popColo,
      region: discovery.region,
      latencyMs: discovery.estimatedLatencyMs,
      cacheStatus: discovery.cacheStatus,
      sub80msSlaMet: discovery.sub80msSlaMet,
      variant: discovery.variant,
    },
    { status: 200 },
  );

  for (const [key, value] of Object.entries(discovery.headers)) {
    response.headers.set(key, value);
  }

  return response;
}

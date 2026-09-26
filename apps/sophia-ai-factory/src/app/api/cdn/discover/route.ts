/**
 * Global Edge CDN Discovery Route
 *
 * Edge runtime endpoint providing sub-80ms p95 latency edge POP routing,
 * optimal variant resolution, and RFC 5861 Cache-Control / Cache-Tag headers.
 *
 * Runtime: Cloudflare Workers Edge
 */

import { NextRequest, NextResponse } from 'next/server';
import { getD1Safe } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  AspectRatio,
  ThumbnailFormat,
  EdgeDiscoverQuery,
  AssetThumbnailVariant,
} from '@/tree/cdn/types';
import {
  isValidAspectRatio,
  isValidThumbnailFormat,
  getThumbnailVariantsByAsset,
} from '@/tree/cdn/thumbnail-generator';
import { discoverEdgeEndpoint, verifyAssetExists } from '@/tree/cdn/cache-mesh-service';

export const runtime = 'edge';

interface ValidatedParams {
  assetId: string;
  preferredRatio: AspectRatio;
  preferredFormat: ThumbnailFormat;
  tenantId?: string;
  preferredRegion?: string;
}

function parseAndValidateParams(searchParams: URLSearchParams): {
  params?: ValidatedParams;
  errorResponse?: NextResponse;
} {
  const assetId = searchParams.get('assetId');
  if (!assetId || assetId.trim().length === 0) {
    return {
      errorResponse: NextResponse.json(
        {
          success: false,
          error: 'MISSING_ASSET_ID',
          message: 'Query parameter "assetId" is required',
        },
        { status: 400 }
      ),
    };
  }

  const aspectRatioParam = searchParams.get('aspectRatio');
  let preferredRatio: AspectRatio = '9:16';
  if (aspectRatioParam) {
    if (!isValidAspectRatio(aspectRatioParam)) {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: 'INVALID_ASPECT_RATIO',
            message: `Aspect ratio must be one of: 9:16, 16:9, 1:1, 4:5. Received: "${aspectRatioParam}"`,
          },
          { status: 400 }
        ),
      };
    }
    preferredRatio = aspectRatioParam;
  }

  const formatParam = searchParams.get('format');
  let preferredFormat: ThumbnailFormat = 'webp';
  if (formatParam) {
    if (!isValidThumbnailFormat(formatParam)) {
      return {
        errorResponse: NextResponse.json(
          {
            success: false,
            error: 'INVALID_FORMAT',
            message: `Format must be one of: webp, avif, jpeg. Received: "${formatParam}"`,
          },
          { status: 400 }
        ),
      };
    }
    preferredFormat = formatParam;
  }

  return {
    params: {
      assetId,
      preferredRatio,
      preferredFormat,
      tenantId: searchParams.get('tenantId') ?? undefined,
      preferredRegion: searchParams.get('region') ?? undefined,
    },
  };
}

function extractEdgeHints(request: NextRequest): {
  country?: string;
  colo?: string;
  coordinates?: { lat: number; lon: number };
} {
  const cfContext = (request as unknown as {
    cf?: {
      colo?: string;
      country?: string;
      latitude?: string;
      longitude?: string;
    };
  }).cf;

  const country = request.headers.get('cf-ipcountry') || cfContext?.country || undefined;
  let colo = request.headers.get('x-edge-colo') || cfContext?.colo || undefined;

  if (!colo) {
    const cfRay = request.headers.get('cf-ray');
    if (cfRay && cfRay.includes('-')) {
      const parts = cfRay.split('-');
      colo = parts[parts.length - 1];
    }
  }

  let coordinates: { lat: number; lon: number } | undefined;
  if (cfContext?.latitude && cfContext?.longitude) {
    const lat = parseFloat(cfContext.latitude);
    const lon = parseFloat(cfContext.longitude);
    if (!isNaN(lat) && !isNaN(lon)) {
      coordinates = { lat, lon };
    }
  }

  return { country, colo, coordinates };
}

async function fetchDbVariantsSafely(assetId: string): Promise<AssetThumbnailVariant[]> {
  try {
    const db = await getD1Safe();
    if (db) {
      return await getThumbnailVariantsByAsset(db, assetId);
    }
  } catch (err) {
    logger.warn('CDN discover could not query D1 variants, falling back to edge synthesizer', {
      assetId,
      error: String(err),
    });
  }
  return [];
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);

  const { params, errorResponse } = parseAndValidateParams(searchParams);
  if (errorResponse) {
    return errorResponse;
  }
  const validated = params!;

  // Authentic asset existence verification against D1, KV, and asset catalog
  const db = await getD1Safe();
  const assetExists = await verifyAssetExists(db, validated.assetId);
  if (!assetExists) {
    const elapsed = Date.now() - startTime;
    return NextResponse.json(
      {
        success: false,
        error: 'ASSET_NOT_FOUND',
        message: `Asset with id "${validated.assetId}" was not found`,
        latencyMs: elapsed,
      },
      { status: 404 }
    );
  }

  const { country, colo, coordinates } = extractEdgeHints(request);
  const dbVariants = await fetchDbVariantsSafely(validated.assetId);

  const query: EdgeDiscoverQuery = {
    assetId: validated.assetId,
    aspectRatio: validated.preferredRatio,
    format: validated.preferredFormat,
    tenantId: validated.tenantId,
    preferredRegion: validated.preferredRegion,
    clientCountry: country,
    clientColo: colo,
    clientCoordinates: coordinates,
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
    { status: 200 }
  );

  for (const [key, value] of Object.entries(discovery.headers)) {
    response.headers.set(key, value);
  }

  return response;
}

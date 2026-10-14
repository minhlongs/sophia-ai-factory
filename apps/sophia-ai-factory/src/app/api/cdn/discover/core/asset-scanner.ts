import { NextRequest, NextResponse } from 'next/server';
import { getD1Safe } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { AspectRatio, ThumbnailFormat, AssetThumbnailVariant } from '@/tree/cdn/types';
import {
  isValidAspectRatio,
  isValidThumbnailFormat,
  getThumbnailVariantsByAsset,
} from '@/tree/cdn/thumbnail-generator';
import type { ValidatedParams, EdgeHints } from './types';

function badRequest(error: string, message: string): NextResponse {
  return NextResponse.json({ success: false, error, message }, { status: 400 });
}

export function parseAndValidateParams(searchParams: URLSearchParams): {
  params?: ValidatedParams;
  errorResponse?: NextResponse;
} {
  const assetId = searchParams.get('assetId');
  if (!assetId || assetId.trim().length === 0) {
    return { errorResponse: badRequest('MISSING_ASSET_ID', 'Query parameter "assetId" is required') };
  }

  const aspectRatioParam = searchParams.get('aspectRatio');
  let preferredRatio: AspectRatio = '9:16';
  if (aspectRatioParam) {
    if (!isValidAspectRatio(aspectRatioParam)) {
      return {
        errorResponse: badRequest(
          'INVALID_ASPECT_RATIO',
          `Aspect ratio must be one of: 9:16, 16:9, 1:1, 4:5. Received: "${aspectRatioParam}"`,
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
        errorResponse: badRequest(
          'INVALID_FORMAT',
          `Format must be one of: webp, avif, jpeg. Received: "${formatParam}"`,
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

export function extractEdgeHints(request: NextRequest): EdgeHints {
  const cf = (request as unknown as {
    cf?: { colo?: string; country?: string; latitude?: string; longitude?: string };
  }).cf;

  const country = request.headers.get('cf-ipcountry') || cf?.country || undefined;
  let colo = request.headers.get('x-edge-colo') || cf?.colo || undefined;
  if (!colo) {
    const cfRay = request.headers.get('cf-ray');
    if (cfRay?.includes('-')) colo = cfRay.split('-').pop();
  }

  let coordinates: { lat: number; lon: number } | undefined;
  if (cf?.latitude && cf?.longitude) {
    const lat = parseFloat(cf.latitude);
    const lon = parseFloat(cf.longitude);
    if (!isNaN(lat) && !isNaN(lon)) coordinates = { lat, lon };
  }

  return { country, colo, coordinates };
}

export async function fetchDbVariantsSafely(assetId: string): Promise<AssetThumbnailVariant[]> {
  try {
    const db = await getD1Safe();
    if (db) return await getThumbnailVariantsByAsset(db, assetId);
  } catch (err) {
    logger.warn('CDN discover could not query D1 variants, falling back to edge synthesizer', {
      assetId,
      error: String(err),
    });
  }
  return [];
}

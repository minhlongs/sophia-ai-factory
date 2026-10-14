import { NextRequest, NextResponse } from 'next/server';
import { getD1Safe } from '@/seed/db/client';
import { verifyAssetExists } from '@/tree/cdn/cache-mesh-service';
import { parseAndValidateParams, extractEdgeHints, fetchDbVariantsSafely } from './asset-scanner';
import { buildDiscoveryResponse } from './manifest-builder';

export async function handleCdnDiscover(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const { searchParams } = new URL(request.url);

  const { params, errorResponse } = parseAndValidateParams(searchParams);
  if (errorResponse) return errorResponse;
  const validated = params!; // guaranteed to exist if err is undefined

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
      { status: 404 },
    );
  }

  const edgeHints = extractEdgeHints(request);
  const dbVariants = await fetchDbVariantsSafely(validated.assetId);

  return buildDiscoveryResponse(validated, edgeHints, dbVariants);
}

/**
 * Helpers for batch usage ingestion route handler.
 * Layer: app/api/v1/usage/batch/core
 * @module app/api/v1/usage/batch/core/batch-usage-helpers
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { batchIngestUsage } from '@/tree/usage-metering/aggregator';
import type { BatchUsageRecord } from '@/tree/usage-metering/types';
import { isOriginAllowed } from '@/seed/security/cors-security-configuration';
import { validateBatchRequest } from './batch-validation';

export async function processBatchUsageRequest(request: NextRequest): Promise<NextResponse> {
  const validation = await validateBatchRequest(request);

  if (!validation.valid) {
    return validation.error!;
  }

  const { requestId, userId, licenseNonce, tier, body } = validation;

  try {
    const events = body.events as BatchUsageRecord[];

    logger.debug('[Batch Ingest API] Processing batch', {
      requestId,
      eventCount: events.length,
      userId,
      licenseNonce,
      tier,
    });

    const normalizedEvents = events.map((event) => ({
      ...event,
      tenant_id: userId,
      license_nonce: licenseNonce,
    }));
    const result = await batchIngestUsage(normalizedEvents, userId);

    logger.debug('[Batch Ingest API] Batch processing complete', {
      requestId,
      total: result.total,
      accepted: result.accepted,
      rejected: result.rejected,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      '[Batch Ingest API] Critical error',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR', requestId },
      { status: 500 },
    );
  }
}

export async function handleBatchUsageOptions(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get('origin');
  if (!origin || !isOriginAllowed(origin)) {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  });
}

/**
 * Batch Usage Ingestion API
 *
 * POST /v1/usage/batch - Ingest multiple usage events in a single request
 *
 * This endpoint accepts an array of usage events and processes them atomically
 * with validation, idempotency checking, and quota enforcement.
 *
 * Authentication:
 *  - Requires x-api-key header with valid API key
 *  - API key must belong to user with active license
 *
 * Request Body:
 * {
 *   events: BatchUsageRecord[]
 * }
 *
 * Response:
 * {
 *   total: number,
 *   accepted: number,
 *   rejected: number,
 *   results: IngestionResult[],
 *   timestamp: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { batchIngestUsage } from '@/forest/usage-metering/aggregator';
import { batchIngestionRequestSchema } from '@/land/validation/services';
import type { BatchUsageRecord, ApiKeyRecord } from '@/forest/usage-metering/types';
import type { D1Response } from '@/seed/db/types';
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { isOriginAllowed } from '@/seed/security/cors-security-configuration';

/**
 * Validate API key and return associated user info
 */
async function validateApiKey(apiKey: string | null): Promise<{
  valid: boolean;
  userId?: string;
  licenseNonce?: string;
  tier?: string;
  error?: string;
}> {
  if (!apiKey) {
    return { valid: false, error: 'Missing API key' };
  }

  try {
    const db = createServerClient();

    // Look up API key in raas_api_keys table
    const { data: apiKeyRecord, error } = await db
      .from('raas_api_keys')
      .select('user_id, license_nonce, is_active, tier')
      .eq('key_hash', apiKey)
      .single() as unknown as D1Response<ApiKeyRecord>;

    if (error || !apiKeyRecord) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (!apiKeyRecord.is_active) {
      return { valid: false, error: 'API key has been deactivated' };
    }

    return {
      valid: true,
      userId: apiKeyRecord.user_id,
      licenseNonce: apiKeyRecord.license_nonce,
      tier: apiKeyRecord.tier || 'BASIC',
    };
  } catch (error) {
    logger.error('[Batch Ingest API] Error validating API key',
      error instanceof Error ? error : new Error(String(error)));
    return { valid: false, error: 'Failed to validate API key' };
  }
}

// Cap batch ingestion at 10 calls/minute per client (each call may carry up to
// 1000 events). Heaviest write surface in /v1; without this an attacker holding
// a leaked key can saturate D1 + quota counters.
export const POST = withRateLimit(async function POST(request: NextRequest) {
  const requestId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    // Step 1: Validate API key
    const apiKey = request.headers.get('x-api-key');
    const authResult = await validateApiKey(apiKey);

    if (!authResult.valid) {
      logger.warn('[Batch Ingest API] Authentication failed', {
        requestId,
        error: authResult.error,
      });
      return NextResponse.json(
        { error: authResult.error, code: 'AUTH_FAILED' },
        { status: 401 }
      );
    }

    const { userId, licenseNonce, tier } = authResult;

    if (!userId || !licenseNonce) {
      return NextResponse.json(
        { error: 'Invalid API key configuration', code: 'INVALID_KEY_CONFIG' },
        { status: 500 }
      );
    }

    // Step 2: Parse and validate request body with Zod
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    // Use Zod schema for validation
    const validation = batchIngestionRequestSchema.safeParse(body);
    if (!validation.success) {
      logger.warn('[Batch Ingest API] Invalid request body', {
        requestId,
        errors: validation.error.flatten(),
      });
      return NextResponse.json(
        {
          error: 'Invalid request body',
          code: 'INVALID_REQUEST',
          details: validation.error.flatten()
        },
        { status: 400 }
      );
    }

    const events = validation.data.events as BatchUsageRecord[];

    logger.debug('[Batch Ingest API] Processing batch', {
      requestId,
      eventCount: events.length,
      userId,
      licenseNonce,
      tier,
    });

    // Step 3: Normalize events - ensure all events use the authenticated user's info
    const normalizedEvents = events.map((event) => ({
      ...event,
      tenant_id: userId,
      license_nonce: licenseNonce,
    }));

    // Step 4: Process batch with validation and quota enforcement
    const result = await batchIngestUsage(normalizedEvents, userId!);

    logger.debug('[Batch Ingest API] Batch processing complete', {
      requestId,
      total: result.total,
      accepted: result.accepted,
      rejected: result.rejected,
    });

    return NextResponse.json(result);

  } catch (error) {
    logger.error('[Batch Ingest API] Critical error',
      error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        requestId,
      },
      { status: 500 }
    );
  }
}, { addHeaders: true, config: { intervalMs: 60_000, maxRequests: 10 } });

export async function OPTIONS(request: NextRequest) {
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
      'Vary': 'Origin',
    },
  });
}

/**
 * Validation helpers for batch usage ingestion.
 * Layer: app/api/v1/usage/batch/core
 * @module app/api/v1/usage/batch/core/batch-validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/seed/utils/logger-utility';
import { validateApiKey } from './api-key-validator';
import type { BatchIngestionRequest } from '@/land/validation/services';

type BatchValidationResult = {
  valid: true;
  userId: string;
  licenseNonce: string;
  tier?: string;
  requestId: string;
  body: BatchIngestionRequest;
} | {
  valid: false;
  requestId: string;
  error: NextResponse;
};

export async function validateBatchRequest(request: NextRequest): Promise<BatchValidationResult> {
  const requestId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // Step 1: Validate API key
  const apiKey = request.headers.get('x-api-key');
  const authResult = await validateApiKey(apiKey);

  if (!authResult.valid) {
    logger.warn('[Batch Ingest API] Authentication failed', {
      requestId,
      error: authResult.error,
    });
    return {
      valid: false,
      requestId,
      error: NextResponse.json(
        { error: authResult.error, code: 'AUTH_FAILED' },
        { status: 401 },
      ),
    };
  }

  const { userId, licenseNonce, tier } = authResult;

  if (!userId || !licenseNonce) {
    return {
      valid: false,
      requestId,
      error: NextResponse.json(
        { error: 'Invalid API key configuration', code: 'INVALID_KEY_CONFIG' },
        { status: 500 },
      ),
    };
  }

  // Step 2: Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      valid: false,
      requestId,
      error: NextResponse.json(
        { error: 'Invalid JSON body', code: 'INVALID_JSON' },
        { status: 400 },
      ),
    };
  }

  // Import Zod schema dynamically
  const { batchIngestionRequestSchema } = await import('@/land/validation/services');
  const validation = batchIngestionRequestSchema.safeParse(body);
  if (!validation.success) {
    logger.warn('[Batch Ingest API] Invalid request body', {
      requestId,
      errors: validation.error.flatten(),
    });
    return {
      valid: false,
      requestId,
      error: NextResponse.json(
        {
          error: 'Invalid request body',
          code: 'INVALID_REQUEST',
          details: validation.error.flatten(),
        },
        { status: 400 },
      ),
    };
  }

  return {
    valid: true,
    requestId,
    userId,
    licenseNonce,
    tier,
    body: validation.data,
  };
}

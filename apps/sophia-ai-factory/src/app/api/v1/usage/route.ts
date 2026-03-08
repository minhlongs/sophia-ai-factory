/**
 * Usage Metering - Batch Ingestion API
 *
 * POST /api/v1/usage - Batch ingest usage records
 * Accepts JSON array of usage records with validation and quota enforcement
 *
 * Request body:
 * {
 *   records: BatchUsageRecord[]
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
import { createClient } from '@/lib/supabase/server';
import { batchIngestUsage } from '@/lib/usage-metering/aggregator';
import { logger } from '@/lib/utils/logger-utility';
import { z } from 'zod';
import type { BatchUsageRecord } from '@/lib/usage-metering/types';
import { withRateLimit } from '@/middleware/rate-limit-wrapper';

/**
 * Zod schema for single usage record
 */
const usageRecordSchema = z.object({
  tenant_id: z.string().uuid(),
  feature_key: z.string().includes('.'),
  timestamp: z.number().int(),
  consumed_units: z.number().min(0),
  request_count: z.number().min(1),
  tokens_input: z.number().min(0).optional().default(0),
  tokens_output: z.number().min(0).optional().default(0),
  license_nonce: z.string().min(1),
  service: z.enum(['heygen', 'elevenlabs', 'openrouter']),
  action: z.string(),
  status: z.enum(['success', 'error']),
  response_time_ms: z.number().nullable().optional(),
}).transform((val) => ({
  ...val,
  response_time_ms: val.response_time_ms ?? null,
})) as z.ZodType<BatchUsageRecord>;

/**
 * Zod schema for batch ingestion request
 */
const batchIngestSchema = z.object({
  records: z.array(usageRecordSchema).min(1).max(1000),
});

// Wrap handler with rate limiting (60 requests per minute for API v1)
export const POST = withRateLimit(async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({
        error: 'Invalid JSON body',
        total: 0,
        accepted: 0,
        rejected: 0,
        results: [],
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const parseResult = batchIngestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({
        error: 'Invalid request body',
        details: parseResult.error.issues,
        total: 0,
        accepted: 0,
        rejected: 0,
        results: [],
        timestamp: new Date().toISOString(),
      }, { status: 400 });
    }

    const { records } = parseResult.data;

    logger.info('[Batch Ingest API] Received batch ingestion request', {
      userId: user.id,
      recordCount: records.length,
    });

    // Process batch ingestion
    const result = await batchIngestUsage(records, user.id);

    logger.info('[Batch Ingest API] Batch ingestion complete', {
      userId: user.id,
      total: result.total,
      accepted: result.accepted,
      rejected: result.rejected,
    });

    return NextResponse.json(result);

  } catch (error) {
    logger.error('[Batch Ingest API] Error', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({
      error: 'Failed to process batch ingestion',
      total: 0,
      accepted: 0,
      rejected: 0,
      results: [],
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}, { addHeaders: true });

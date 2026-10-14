/**
 * Hourly Rollup — upsert and runner
 * Aggregation logic lives in hourly-rollup-calculator.ts
 *
 * Layer: tree/usage-metering/rollup
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { getErrorMessage } from '@/seed/utils/to-error';
import type { HourlySummaryRecord } from './rollup-utils';

export { calculateHourlyRollup } from './hourly-rollup-calculator';
import { calculateHourlyRollup } from './hourly-rollup-calculator';

/**
 * Insert or update hourly summary (idempotent upsert)
 *
 * @param summary - Hourly summary record
 */
export async function upsertHourlySummary(summary: HourlySummaryRecord): Promise<void> {
  const db = createServerClient();

  const insertPayload: Record<string, unknown> = {
    hour_timestamp: summary.hourTimestamp,
    tenant_id: summary.tenantId,
    license_nonce: summary.licenseNonce,
    external_customer_id: summary.externalCustomerId,
    total_requests: summary.totalRequests,
    total_credits: summary.totalCredits,
    total_tokens_input: summary.totalTokensInput,
    total_tokens_output: summary.totalTokensOutput,
    total_errors: summary.totalErrors,
    avg_response_time_ms: summary.avgResponseTimeMs,
    service_breakdown: summary.serviceBreakdown,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from('usage_hourly_summary')
    .insert(insertPayload);

  if (error) {
    const err = new Error(error.message);
    logger.error('[Rollup Service] Error upserting hourly summary', err, {
      hourTimestamp: summary.hourTimestamp,
      tenantId: summary.tenantId,
    });
    throw err;
  }
}

/**
 * Run hourly rollup for a specific hour
 *
 * @param hourTimestamp - Unix timestamp of hour start (defaults to previous hour)
 */
export async function runHourlyRollup(hourTimestamp?: number): Promise<{
  processed: number;
  success: boolean;
  error?: string;
}> {
  try {
    const timestamp = hourTimestamp ?? (Math.floor(Date.now() / 3600000) - 1) * 3600;
    const hourStart = new Date(timestamp * 1000).toISOString();

    logger.info('[Rollup Service] Starting hourly rollup', { hourStart });

    const summaries = await calculateHourlyRollup(timestamp);
    for (const summary of summaries) {
      await upsertHourlySummary(summary);
    }

    logger.info('[Rollup Service] Hourly rollup complete', { hourStart, processed: summaries.length });
    return { processed: summaries.length, success: true };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('[Rollup Service] Hourly rollup failed', new Error(errorMessage));
    return { processed: 0, success: false };
  }
}

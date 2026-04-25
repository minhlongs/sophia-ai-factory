/**
 * Daily Rollup — upsert and runner
 * Aggregation logic lives in daily-rollup-calculator.ts
 */

import { createServerClient } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';
import { getErrorMessage } from '@/lib/utils/to-error';
import type { DailySummaryRecord } from './rollup-utils';

export { calculateDailyRollup } from './daily-rollup-calculator';

/**
 * Insert or update daily summary (idempotent upsert)
 */
export async function upsertDailySummary(summary: DailySummaryRecord): Promise<void> {
  const db = createServerClient();

  const insertPayload: Record<string, unknown> = {
    day_timestamp: summary.dayTimestamp,
    tenant_id: summary.tenantId,
    license_nonce: summary.licenseNonce,
    external_customer_id: summary.externalCustomerId,
    total_requests: summary.totalRequests,
    total_credits: summary.totalCredits,
    total_tokens_input: summary.totalTokensInput,
    total_tokens_output: summary.totalTokensOutput,
    total_errors: summary.totalErrors,
    avg_response_time_ms: summary.avgResponseTimeMs,
    hourly_breakdown: summary.hourlyBreakdown,
    service_breakdown: summary.serviceBreakdown,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db
    .from('usage_daily_summary')
    .insert(insertPayload);

  if (error) {
    const err = new Error(error.message);
    logger.error('[Rollup Service] Error upserting daily summary', err, {
      dayTimestamp: summary.dayTimestamp,
      tenantId: summary.tenantId,
    });
    throw err;
  }
}

/**
 * Run daily rollup for a specific day (defaults to yesterday)
 */
export async function runDailyRollup(dayTimestamp?: number): Promise<{
  processed: number;
  success: boolean;
  error?: string;
}> {
  try {
    const now = Math.floor(Date.now() / 86400000);
    const timestamp = dayTimestamp ?? ((now - 1) * 86400);
    const dayStart = new Date(timestamp * 1000).toISOString();

    logger.info('[Rollup Service] Starting daily rollup', { dayStart });

    const { calculateDailyRollup } = await import('./daily-rollup-calculator');
    const summaries = await calculateDailyRollup(timestamp);
    for (const summary of summaries) {
      await upsertDailySummary(summary);
    }

    logger.info('[Rollup Service] Daily rollup complete', { dayStart, processed: summaries.length });
    return { processed: summaries.length, success: true };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    logger.error('[Rollup Service] Daily rollup failed', new Error(errorMessage));
    return { processed: 0, success: false };
  }
}

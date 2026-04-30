/**
 * Cost Ledger
 *
 * Records per-stage USD cost rows in video_cost_log and updates
 * the cumulative cost_usd on the video_jobs row.
 */

import { getD1Client } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger-utility';

export interface CostRecord {
  jobId: string;
  stage: string;
  provider: string;
  units: number;
  costUsd: number;
}

/**
 * Insert a cost ledger row and bump video_jobs.cost_usd atomically.
 * Safe to call inside an Inngest step.run().
 */
export async function recordCost(record: CostRecord): Promise<void> {
  const { jobId, stage, provider, units, costUsd } = record;
  const recordedAt = Math.floor(Date.now() / 1000);

  const db = await getD1Client();

  try {
    await db
      .from('video_cost_log')
      .insert({ job_id: jobId, stage, provider, units, cost_usd: costUsd, recorded_at: recordedAt });

    // Increment cumulative cost_usd on the job row
    const { data: existing } = await db
      .from('video_jobs')
      .select('cost_usd')
      .eq('id', jobId)
      .single();
    const currentCost = (existing as { cost_usd?: number } | null)?.cost_usd ?? 0;
    await db
      .from('video_jobs')
      .update({ cost_usd: currentCost + costUsd, updated_at: recordedAt })
      .eq('id', jobId);
  } catch (err) {
    logger.warn('[CostLedger] Failed to record cost', { jobId, stage, error: String(err) });
    // Non-fatal: cost tracking failure should not fail the pipeline
  }
}

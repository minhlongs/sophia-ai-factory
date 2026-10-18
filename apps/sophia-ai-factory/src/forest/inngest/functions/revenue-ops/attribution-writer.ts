/**
 * Attribution provenance persistence and job economics update steps.
 * @module forest/inngest/functions/revenue-ops/attribution-writer
 */

import type { D1Database } from '@cloudflare/workers-types';
import { computeGrossMargin } from '@/seed/types/creative-job-economics';
import {
  ATTRIBUTION_WINDOW_DAYS,
  type UnattributedJobRow,
  type AttributionCandidateWinner,
} from './types';

/**
 * Write provenance row with INSERT OR IGNORE. Returns true if this call
 * "owns" the row (meta.changes === 1), false if it already existed.
 */
export async function writeProvenance(
  db: D1Database,
  job: UnattributedJobRow,
  winner: AttributionCandidateWinner,
  jobCompletedAtMs: number,
): Promise<boolean> {
  const { meta } = await db
    .prepare(
      `INSERT OR IGNORE INTO attribution_provenance
         (media_job_id, source_event_id, source_type, channel,
          attributed_amount_cents, attribution_rule, attribution_window_days,
          job_completed_at, revenue_recorded_at)
       VALUES (?, ?, ?, ?, ?, 'last-touch-within-window', ?, ?, ?)`,
    )
    .bind(
      job.id,
      winner.sourceEventId,
      winner.sourceType,
      winner.channel,
      winner.valueCents,
      ATTRIBUTION_WINDOW_DAYS,
      jobCompletedAtMs,
      winner.recordedAt,
    )
    .run();
  return (meta?.changes ?? 0) === 1;
}

/**
 * Update media_jobs with attributed revenue + computed gross margin.
 * gross_margin = computeGrossMargin(provider_cost, revenue_attribution).
 * If provider_cost is NULL, computeGrossMargin returns NULL (no fabrication).
 */
export async function updateJobEconomics(
  db: D1Database,
  jobId: string,
  revenueCents: number,
  providerCostCents: number | null,
): Promise<void> {
  const grossMargin = computeGrossMargin(providerCostCents, revenueCents);
  await db
    .prepare(
      `UPDATE media_jobs
       SET revenue_attribution = ?, gross_margin = ?
       WHERE id = ?`,
    )
    .bind(revenueCents, grossMargin, jobId)
    .run();
}

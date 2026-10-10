/**
 * Attribution processor database queries and persistence steps.
 * @module forest/inngest/functions/revenue-ops/attribution-processor
 */

import type { D1Database } from '@cloudflare/workers-types';
import { resolveOrgId } from '@/seed/auth/resolve-org-id';
import { computeGrossMargin } from '@/seed/types/creative-job-economics';
import {
  ATTRIBUTION_WINDOW_DAYS,
  BATCH_SIZE,
  type UnattributedJobRow,
  type PerformanceEventRow,
  type AttributionProvenanceRow,
  type AttributionCandidateWinner,
} from './types';

/**
 * Resolve the user's workspace using canonical resolveOrgId.
 * org_id == workspace_id (verified in CMD #10 scout truth table T8/T19).
 */
export async function resolveWorkspaceId(db: D1Database, userId: string): Promise<string | null> {
  return resolveOrgId(userId, db);
}

/**
 * Fetch unattributed completed media_jobs in pages of BATCH_SIZE.
 * A job is unattributed when revenue_attribution IS NULL AND completed_at IS NOT NULL.
 */
export async function fetchUnattributedJobs(
  db: D1Database,
  offset: number,
): Promise<UnattributedJobRow[]> {
  const result = await db
    .prepare(
      `SELECT id, user_id, completed_at, provider_cost
       FROM media_jobs
       WHERE status = 'completed'
         AND revenue_attribution IS NULL
         AND completed_at IS NOT NULL
       ORDER BY completed_at ASC
       LIMIT ? OFFSET ?`,
    )
    .bind(BATCH_SIZE, offset)
    .all<UnattributedJobRow>();
  return result.results ?? [];
}

/**
 * Fetch revenue events for a workspace within the attribution window.
 *
 * CRITICAL TIMING: media_jobs.completed_at is SECONDS,
 * performance_events.recorded_at is MILLISECONDS.
 * We multiply job.completed_at by 1000 to convert to ms before comparing.
 */
export async function fetchRevenueEvents(
  db: D1Database,
  workspaceId: string,
  jobCompletedAtMs: number,
): Promise<PerformanceEventRow[]> {
  const windowMs = ATTRIBUTION_WINDOW_DAYS * 86400 * 1000;
  const upperBound = jobCompletedAtMs + windowMs;
  const result = await db
    .prepare(
      `SELECT id, event_type, channel, value_cents, recorded_at
       FROM performance_events
       WHERE workspace_id = ?
         AND recorded_at >= ?
         AND recorded_at <= ?
         AND event_type IN ('conversion', 'revenue')
       ORDER BY recorded_at ASC`,
    )
    .bind(workspaceId, jobCompletedAtMs, upperBound)
    .all<PerformanceEventRow>();
  return result.results ?? [];
}

/**
 * Filter out events already claimed by another job (idempotency).
 * Returns the set of already-claimed source_event_ids.
 */
export async function fetchClaimedEventIds(
  db: D1Database,
  eventIds: string[],
): Promise<string[]> {
  if (eventIds.length === 0) return [];
  // D1 does not support array binding; build a parameterized IN clause.
  const placeholders = eventIds.map(() => '?').join(', ');
  const result = await db
    .prepare(`SELECT source_event_id FROM attribution_provenance WHERE source_event_id IN (${placeholders})`)
    .bind(...eventIds)
    .all<AttributionProvenanceRow>();
  const rows = result.results ?? [];
  return rows.map((r) => r.source_event_id);
}

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

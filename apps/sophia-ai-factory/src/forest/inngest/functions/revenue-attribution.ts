/**
 * Inngest Cron: Revenue Attribution
 * Runs every 12 hours — attributes revenue to unattributed completed media_jobs.
 *
 * For each completed media_job with no revenue_attribution yet, finds the
 * last-touch revenue event (from performance_events) within a bounded window
 * (default 30 days), writes an attribution_provenance row, and updates
 * media_jobs.revenue_attribution + gross_margin.
 *
 * Idempotency: re-running the cron re-selects the same unattributed jobs
 * (revenue_attribution IS NULL). INSERT OR IGNORE on provenance PK makes
 * duplicate writes no-ops. meta.changes check ensures only the first writer
 * commits the UPDATE. Net effect: second run updates 0 rows.
 *
 * SUPREME COMMAND #10 — Phase 2
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@cloudflare/workers-types';
import { logger } from '@/seed/utils/logger-utility';
import { computeGrossMargin, selectLastTouch } from '@/seed/types/creative-job-economics';

interface UnattributedJobRow {
  id: string;
  user_id: string;
  completed_at: number;
  provider_cost: number | null;
}

interface OrgMemberRow {
  org_id: string;
}

interface PerformanceEventRow {
  id: string;
  event_type: string;
  channel: string;
  value_cents: number;
  recorded_at: number;
}

interface AttributionProvenanceRow {
  source_event_id: string;
}

const ATTRIBUTION_WINDOW_DAYS = 30;
const BATCH_SIZE = 100;

/**
 * Resolve the user's workspace from org_members (first membership).
 * org_id == workspace_id (verified in CMD #10 scout truth table T8/T19).
 */
async function resolveWorkspaceId(db: D1Database, userId: string): Promise<string | null> {
  const row = await db
    .prepare('SELECT org_id FROM org_members WHERE user_id = ? LIMIT 1')
    .bind(userId)
    .first<OrgMemberRow>();
  return row?.org_id ?? null;
}

/**
 * Fetch unattributed completed media_jobs in pages of BATCH_SIZE.
 * A job is unattributed when revenue_attribution IS NULL AND completed_at IS NOT NULL.
 */
async function fetchUnattributedJobs(
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
async function fetchRevenueEvents(
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
async function fetchClaimedEventIds(
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
async function writeProvenance(
  db: D1Database,
  job: UnattributedJobRow,
  winner: { sourceEventId: string; sourceType: string; channel: string; valueCents: number; recordedAt: number },
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
async function updateJobEconomics(
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

export const revenueAttribution = inngest.createFunction(
  { id: 'revenue-attribution', name: 'Revenue Attribution', retries: 2 },
  { cron: '0 */12 * * *' },
  async ({ step }) => {
    let totalAttributed = 0;
    let totalSkipped = 0;
    let offset = 0;

    // Batch through unattributed jobs in pages of BATCH_SIZE.
    // D1 has no transactions — avoid giant single queries.
    while (true) {
      const jobs = await step.run(`fetch-unattributed-jobs-${offset}`, async () => {
        const _db = await getD1();
        if (!_db) throw new Error('D1 database binding not available');
        return fetchUnattributedJobs(_db, offset);
      });

      if (jobs.length === 0) break;

      for (const job of jobs) {
        // CRITICAL: completed_at is SECONDS, recorded_at is MILLISECONDS.
        const jobCompletedAtMs = job.completed_at * 1000;

        // Step 2: resolve workspace
        const workspaceId = await step.run(`resolve-workspace-${job.id}`, async () => {
          const _db = await getD1();
          if (!_db) throw new Error('D1 database binding not available');
          return resolveWorkspaceId(_db, job.user_id);
        });

        if (!workspaceId) {
          totalSkipped++;
          logger.debug('[revenue-attribution] Workspace unresolved — skipping job', {
            jobId: job.id,
          });
          continue;
        }

        // Step 3: fetch revenue events in window
        const events = await step.run(`fetch-revenue-events-${job.id}`, async () => {
          const _db = await getD1();
          if (!_db) throw new Error('D1 database binding not available');
          return fetchRevenueEvents(_db, workspaceId, jobCompletedAtMs);
        });

        if (events.length === 0) {
          totalSkipped++;
          logger.debug('[revenue-attribution] No revenue in window — leaving NULL', {
            jobId: job.id,
          });
          continue;
        }

        // Step 4: filter out already-claimed events (prevents double-counting)
        const claimedIds = await step.run(`fetch-claimed-${job.id}`, async () => {
          const _db = await getD1();
          if (!_db) throw new Error('D1 database binding not available');
          return fetchClaimedEventIds(_db, events.map((e) => e.id));
        });
        const claimed = new Set(claimedIds);

        const candidates = events
          .filter((e) => !claimed.has(e.id))
          .map((e) => ({
            sourceEventId: e.id,
            sourceType: e.event_type as 'conversion' | 'revenue',
            channel: e.channel as 'tiktok' | 'youtube',
            valueCents: e.value_cents,
            recordedAt: e.recorded_at,
          }));

        // Step 5: select last-touch within window
        const winner = selectLastTouch(candidates, {
          jobCompletedAt: jobCompletedAtMs,
          windowDays: ATTRIBUTION_WINDOW_DAYS,
        });

        if (!winner) {
          totalSkipped++;
          logger.debug('[revenue-attribution] No winner — leaving NULL', {
            jobId: job.id,
          });
          continue;
        }

        // Step 6: write provenance + update job (only if we own the provenance row)
        const owned = await step.run(`write-provenance-${job.id}`, async () => {
          const _db = await getD1();
          if (!_db) throw new Error('D1 database binding not available');
          return writeProvenance(_db, job, winner, jobCompletedAtMs);
        });

        if (!owned) {
          // Another run claimed this event between fetch and write — skip.
          totalSkipped++;
          logger.debug('[revenue-attribution] Provenance already owned — skipping', {
            jobId: job.id,
            sourceEventId: winner.sourceEventId,
          });
          continue;
        }

        await step.run(`update-job-economics-${job.id}`, async () => {
          const _db = await getD1();
          if (!_db) throw new Error('D1 database binding not available');
          await updateJobEconomics(_db, job.id, winner.valueCents, job.provider_cost);
        });

        totalAttributed++;
      }

      offset += BATCH_SIZE;
    }

    // Phase 5 — data retention: prune provenance older than 90 days.
    // Provenance is point-in-time; after 90d the settled fact lives on
    // media_jobs.revenue_attribution. Pruning keeps the table bounded.
    const pruned = await step.run('prune-provenance', async () => {
      const _db = await getD1();
      if (!_db) throw new Error('D1 database binding not available');
      const ninetyDaysMs = 90 * 86400 * 1000;
      const cutoff = Date.now() - ninetyDaysMs;
      const res = await _db
        .prepare(`DELETE FROM attribution_provenance WHERE created_at < ?`)
        .bind(cutoff)
        .run();
      return res.meta?.changes ?? 0;
    });

    logger.info('[revenue-attribution] Complete', {
      attributed: totalAttributed,
      skipped: totalSkipped,
      pruned,
    });
    return { attributed: totalAttributed, skipped: totalSkipped, pruned };
  },
);

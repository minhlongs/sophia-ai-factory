/**
 * Revenue Attribution Inngest Cron Job.
 * @module forest/inngest/functions/revenue-ops/revenue-attribution-job
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { selectLastTouch } from '@/seed/types/creative-job-economics';
import { BATCH_SIZE, ATTRIBUTION_WINDOW_DAYS } from './types';
import {
  fetchUnattributedJobs,
  resolveWorkspaceId,
  fetchRevenueEvents,
  fetchClaimedEventIds,
  writeProvenance,
  updateJobEconomics,
} from './attribution-processor';

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

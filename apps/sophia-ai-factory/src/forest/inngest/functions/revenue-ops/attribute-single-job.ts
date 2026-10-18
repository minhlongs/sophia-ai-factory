/**
 * Per-job attribution and provenance pruning step helpers for Revenue Attribution Inngest job.
 * @module forest/inngest/functions/revenue-ops/attribute-single-job
 */

import { getD1 } from '@/seed/db/client';
import type { GetStepTools } from 'inngest';
import type { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { selectLastTouch } from '@/seed/types/creative-job-economics';
import { ATTRIBUTION_WINDOW_DAYS, type UnattributedJobRow } from './types';
import {
  resolveWorkspaceId,
  fetchRevenueEvents,
  fetchClaimedEventIds,
  writeProvenance,
  updateJobEconomics,
} from './attribution-processor';

export type StepRunner = GetStepTools<typeof inngest>;

export async function attributeSingleJob(
  step: StepRunner,
  job: UnattributedJobRow,
): Promise<'attributed' | 'skipped'> {
  // CRITICAL: completed_at is SECONDS, recorded_at is MILLISECONDS.
  const jobCompletedAtMs = job.completed_at * 1000;

  // Step 2: resolve workspace
  const workspaceId = await step.run(`resolve-workspace-${job.id}`, async () => {
    const _db = await getD1();
    if (!_db) throw new Error('D1 database binding not available');
    return resolveWorkspaceId(_db, job.user_id);
  });

  if (!workspaceId) {
    logger.debug('[revenue-attribution] Workspace unresolved — skipping job', {
      jobId: job.id,
    });
    return 'skipped';
  }

  // Step 3: fetch revenue events in window
  const events = await step.run(`fetch-revenue-events-${job.id}`, async () => {
    const _db = await getD1();
    if (!_db) throw new Error('D1 database binding not available');
    return fetchRevenueEvents(_db, workspaceId, jobCompletedAtMs);
  });

  if (events.length === 0) {
    logger.debug('[revenue-attribution] No revenue in window — leaving NULL', {
      jobId: job.id,
    });
    return 'skipped';
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
    logger.debug('[revenue-attribution] No winner — leaving NULL', {
      jobId: job.id,
    });
    return 'skipped';
  }

  // Step 6: write provenance + update job (only if we own the provenance row)
  const owned = await step.run(`write-provenance-${job.id}`, async () => {
    const _db = await getD1();
    if (!_db) throw new Error('D1 database binding not available');
    return writeProvenance(_db, job, winner, jobCompletedAtMs);
  });

  if (!owned) {
    logger.debug('[revenue-attribution] Provenance already owned — skipping', {
      jobId: job.id,
      sourceEventId: winner.sourceEventId,
    });
    return 'skipped';
  }

  await step.run(`update-job-economics-${job.id}`, async () => {
    const _db = await getD1();
    if (!_db) throw new Error('D1 database binding not available');
    await updateJobEconomics(_db, job.id, winner.valueCents, job.provider_cost);
  });

  return 'attributed';
}

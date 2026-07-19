/**
 * NOWPayments IPN Dead-Letter Queue cleanup job.
 *
 * Scheduled task — hard-deletes DLQ rows whose `last_attempted_at` is older
 * than `DLQ_MAX_AGE_DAYS` (environment-configurable, default 7). Uses
 * batch deletion (`DLQ_CLEANUP_BATCH`, default 500) to bound each run and
 * avoid oversized transactions on D1 (SQLite).
 *
 * Runs as an Inngest cron (see `dlqCleanupCron`). Because Inngest serializes
 * a function's cron into the deployment, the job does NOT require operator
 * registration with external providers — aligned with the no-tech doctrine.
 *
 * Rationale for the 7-day default:
 * - Gives the admin reconciliation UI up to 7 days to replay entries.
 * - After the window only retained aggregates should remain in external
 *   observability (handled by `dlq-reaper` + Sentry alert paths).
 *
 * @module forest/webhooks/nowpayments-ipn-cleanup
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';

// ── Configurable knobs ─────────────────────────────────────────────────────────
//
// Override by setting env vars on the wrangler deployment:
//   DLQ_MAX_AGE_DAYS   (default: 7)
//   DLQ_CLEANUP_BATCH  (default: 500, must be > 0)
//
// Using process.env directly follows the existing project convention
// (see `auto-discover-affiliates.ts` TELEGRAM_ADMIN_CHAT_ID, `video-scripting.ts`
// OPENROUTER_API_KEY, etc.).

const DLQ_MAX_AGE_DAYS = Math.max(
  1,
  Number.parseInt(process.env.DLQ_MAX_AGE_DAYS ?? '7', 10),
);

const DLQ_CLEANUP_BATCH = Math.max(
  1,
  Number.parseInt(process.env.DLQ_CLEANUP_BATCH ?? '500', 10),
);

const DLQ_TABLE = 'ipn_dead_letter_queue';

// ── Core cleanup helper ────────────────────────────────────────────────────────

/**
 * Hard-delete DLQ rows older than `maxAgeDays`, capped per batch to keep each
 * D1 transaction small. Returns the number of rows removed.
 *
 * Pure D1 — no Supabase client abstraction, so it works both in CF Workers
 * and in Node-based tests that mock `getD1()`.
 */
export async function cleanupDlq(
  maxAgeDays: number = DLQ_MAX_AGE_DAYS,
  batchSize: number = DLQ_CLEANUP_BATCH,
): Promise<number> {
  const db = getD1();
  if (!db) {
    logger.warn('[dlq-cleanup] D1 binding unavailable — skipping run');
    return 0;
  }

  // Compute the cutoff timestamp once so the whole batch sees a stable target.
  const cutoffIso = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

  let totalDeleted = 0;

  // Loop until the current batch removes nothing (table drained for this window)
  // or until an unexpected error occurs. The loop naturally terminates when
  // there are no more rows in scope, bound by the cap to avoid pathological
  // large deletes.
  for (;;) {
    const { meta } = await db
      .prepare(
        `DELETE FROM ${DLQ_TABLE}
         WHERE last_attempted_at < :cutoff
         LIMIT :batch`,
      )
      .bind({ cutoff: cutoffIso, batch: batchSize })
      .run();

    const removed = meta.changes ?? 0;
    totalDeleted += removed;

    if (removed < batchSize) {
      // Either nothing left in the window, or fewer rows than the batch size
      // — either way we're done for this run.
      break;
    }

    // More rows remain in the window — continue looping. Bound protection comes
    // from `batchSize`, not from an arbitrary iteration cap, so a burst backfill
    // still drains predictably.
  }

  if (totalDeleted > 0) {
    logger.info('[dlq-cleanup] Completed', {
      maxAgeDays,
      batchSize,
      totalDeleted,
      cutoff: cutoffIso,
    });
  }

  return totalDeleted;
}

// ── Inngest scheduled entry point ─────────────────────────────────────────────
//
// Runs daily at 04:00 UTC (low-traffic window). Inngest's cron syntax follows
// the standard 5-field Vixie cron.

export const dlqCleanupCron = inngest.createFunction(
  {
    id: 'dlq-cleanup',
    // Single retry — if the run fails once (transient D1 unavailability),
    // the next daily schedule still correctly targets the next 24h window.
    retries: 1,
  },
  { cron: '0 4 * * *' },
  async () => {
    const deleted = await cleanupDlq();
    return { maxAgeDays: DLQ_MAX_AGE_DAYS, batchSize: DLQ_CLEANUP_BATCH, deleted };
  },
);

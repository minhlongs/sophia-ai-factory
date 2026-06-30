/**
 * SOP Scheduler — cron tick handler
 *
 * Claims up to 20 due SOP installations and runs them in parallel.
 * Called by /api/cron/sop-scheduler every 5 minutes.
 *
 * Idempotent: claimDueInstallations advances next_run_at before dispatch,
 * so even if the tick fires twice, the same rows won't be double-processed.
 */

import { claimDueInstallations } from '@/tree/sop/sop-repo-installations';
import { logger } from '@/seed/utils/logger-utility';
import type { RunContext, RunResult } from '@/seed/sop/executor/types';

const MAX_PER_TICK = 20;

/**
 * Handle a single SOP scheduler cron tick.
 * Returns count of installations processed.
 *
 * @param runSopFn - Injected runSop callback (to avoid land→forest import violation)
 */
export async function handleSopSchedulerTick(
  db: D1Database,
  runSopFn?: (db: D1Database, ctx: RunContext) => Promise<RunResult>,
): Promise<{ processed: number }> {
  const now = Math.floor(Date.now() / 1000);

  let due;
  try {
    due = await claimDueInstallations(db, now, MAX_PER_TICK);
  } catch (err) {
    logger.error('[sop-scheduler] claimDue failed', err instanceof Error ? err : new Error(String(err)));
    return { processed: 0 };
  }

  if (due.length === 0) {
    logger.debug('[sop-scheduler] No due installations');
    return { processed: 0 };
  }

  if (!runSopFn) {
    logger.error('[sop-scheduler] runSopFn callback required but not provided');
    return { processed: 0 };
  }

  logger.info('[sop-scheduler] Claimed installations', { count: due.length });

  const results = await Promise.allSettled(
    due.map(inst =>
      runSopFn(db, {
        installationId: inst.id,
        runId: '',           // created inside runSop
        userId: inst.user_id,
        trigger: 'cron',
      }),
    ),
  );

  let successCount = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      successCount++;
    } else {
      logger.error('[sop-scheduler] run error', result.reason instanceof Error
        ? result.reason
        : new Error(String(result.reason)));
    }
  }

  logger.info('[sop-scheduler] Tick complete', { processed: due.length, succeeded: successCount });
  return { processed: due.length };
}

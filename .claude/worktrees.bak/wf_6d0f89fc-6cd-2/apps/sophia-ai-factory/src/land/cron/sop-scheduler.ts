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
import { runSop } from '@/forest/missions/sop-runner';
import { logger } from '@/seed/utils/logger-utility';

const MAX_PER_TICK = 20;

/**
 * Handle a single SOP scheduler cron tick.
 * Returns count of installations processed.
 */
export async function handleSopSchedulerTick(db: D1Database): Promise<{ processed: number }> {
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

  logger.info('[sop-scheduler] Claimed installations', { count: due.length });

  const results = await Promise.allSettled(
    due.map(inst =>
      runSop(db, {
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

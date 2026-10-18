/**
 * Experiment Feedback Cron — Write decided experiment winners to creative memory
 *
 * Runs daily. Finds all experiments with status='decided' and writes the winning
 * variant to creative_memory as key `experiment:<id>:winner`. Idempotent:
 * re-running for the same experiment overwrites the same memory key.
 *
 * Layer: forest (infra orchestrator)
 *
 * @module forest/inngest/functions/experiment-feedback-cron
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { getD1 } from '@/seed/db/client';
import { recordLearning } from '@/tree/creative-memory';
import {
  buildWinnerPayload,
  type DecidedExperimentRow,
  type FeedbackResult,
} from './experiment-feedback-helpers';

export { buildWinnerPayload, type DecidedExperimentRow, type FeedbackResult };

export const experimentFeedbackCron = inngest.createFunction(
  {
    id: 'experiment-feedback-cron',
    name: 'Experiment Feedback Cron',
    concurrency: { limit: 1 },
  },
  { cron: '0 3 * * *' }, // daily at 03:00 UTC
  async () => {
    const db = await getD1();
    if (!db) {
      logger.error('[experiment-feedback-cron] D1 not available');
      return { processed: 0, written: 0 };
    }

    // Step 1: Fetch all decided experiments that haven't been written yet.
    const { results: decidedRows } = await db
      .prepare(
        `SELECT * FROM ab_experiments
         WHERE status = 'decided'
         ORDER BY decided_at ASC
         LIMIT 100`
      )
      .all<DecidedExperimentRow>();

    if (!decidedRows || decidedRows.length === 0) {
      return { processed: 0, written: 0 };
    }

    let written = 0;

    // Step 2: For each decided experiment, write winner to creative_memory.
    // recordLearning does an upsert, so re-runs are idempotent.
    for (const row of decidedRows) {
      try {
        const memoryKey = `experiment:${row.id}:winner`;
        const payload = buildWinnerPayload(row);
        const evidence = JSON.stringify({
          experiment_id: row.id,
          video_id: row.video_id,
          decided_at: row.decided_at,
          winner: row.winner,
        });

        await recordLearning(
          row.tenant_id,
          'performance',
          memoryKey,
          payload,
          evidence,
          'global',
          undefined,
        );
        written++;
      } catch (err) {
        logger.error('[experiment-feedback-cron] Failed to write memory', {
          experimentId: row.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[experiment-feedback-cron] Completed', {
      processed: decidedRows.length,
      written,
    });

    return { processed: decidedRows.length, written } satisfies FeedbackResult;
  },
);

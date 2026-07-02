/**
 * AB Winner Picker Cron — Evaluate active AB experiments and mark winners
 *
 * Runs every 6 hours. Fetches active experiments older than 1 hour,
 * evaluates them via the CTR-based winner-picker logic, and persists
 * any winner/no_winner decisions via experiment-store.
 *
 * @module forest/inngest/functions/ab-winner-picker-cron
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import { logAuditEvent } from '@/tree/audit/logger/audit-query';
import {
  getActiveExperimentsOlderThan,
  markWinner,
} from '@/forest/ab/experiment-store';
import { evaluateBatch } from '@/forest/ab/winner-picker';

export const abWinnerPickerCron = inngest.createFunction(
  { id: 'ab-winner-picker-cron' },
  { cron: '0 */6 * * *' },
  async ({ step }) => {
    const experiments = await step.run('fetch-active-experiments', async () => {
      return getActiveExperimentsOlderThan(1);
    });

    if (experiments.length === 0) {
      logger.info('[ab-winner-picker-cron] No active experiments to evaluate');
      return { evaluated: 0, winners: 0, decisions: 0 };
    }

    logger.info('[ab-winner-picker-cron] Fetched active experiments', {
      count: experiments.length,
    });

    const decisions = await step.run('evaluate-experiments', async () => {
      return evaluateBatch(experiments);
    });

    if (decisions.length === 0) {
      logger.info('[ab-winner-picker-cron] No experiments ready for winner decision', {
        evaluated: experiments.length,
      });

      await logAuditEvent({
        action: 'ab_experiment.winner_evaluation',
        userId: 'system',
        metadata: {
          evaluatedCount: experiments.length,
          decisionsCount: 0,
          actorType: 'system',
        },
      }).catch((err: unknown) => {
        logger.error('[ab-winner-picker-cron] Audit log failed', { error: err });
      });

      return { evaluated: experiments.length, winners: 0, decisions: 0 };
    }

    const results = await step.run('mark-winners', async () => {
      const winners: Array<{
        experimentId: string;
        winner: string;
        reason: string;
      }> = [];

      for (const decision of decisions) {
        await markWinner(decision.experimentId, decision.winner);
        winners.push({
          experimentId: decision.experimentId,
          winner: decision.winner,
          reason: decision.reason,
        });
      }

      return winners;
    });

    await logAuditEvent({
      action: 'ab_experiment.winner_evaluation',
      userId: 'system',
      metadata: {
        evaluatedCount: experiments.length,
        decisionsCount: decisions.length,
        winners: results.map((r) => ({
          experimentId: r.experimentId,
          winner: r.winner,
          reason: r.reason,
        })),
        actorType: 'system',
      },
    }).catch((err: unknown) => {
      logger.error('[ab-winner-picker-cron] Audit log failed', { error: err });
    });

    logger.info('[ab-winner-picker-cron] Winner evaluation complete', {
      evaluated: experiments.length,
      decisions: decisions.length,
      winners: results.length,
    });

    return {
      evaluated: experiments.length,
      decisions: decisions.length,
      winners: results.length,
    };
  },
);

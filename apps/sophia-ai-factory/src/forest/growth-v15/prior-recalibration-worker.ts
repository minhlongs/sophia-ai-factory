/**
 * Prior Recalibration Worker
 * Closed-loop Inngest worker recalibrating Bayesian Beta-Binomial priors from post-publish analytics.
 *
 * Layer: forest/growth-v15 | Max LOC: < 200 | Zero :any
 */

import { inngest } from '@/seed/inngest/client';
import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { updateBayesianPrior } from '@/land/growth-v15/feedback-coordinator';

export const priorRecalibrationWorker = inngest.createFunction(
  {
    id: 'growth-v15-prior-recalibration',
    name: 'Growth v15: Prior Recalibration Worker',
  },
  { event: 'growth/v15.prior.recalibrate' },
  async ({ event, step }) => {
    const {
      userId,
      dimKey,
      dimVal,
      normalizedCompletionScore,
      dampeningFactor = 0.85,
    } = event.data;

    logger.info('Processing Bayesian prior recalibration', {
      userId,
      dimKey,
      dimVal,
      score: normalizedCompletionScore,
    });

    // Step 1: Fetch current prior state from D1
    const currentPrior = await step.run('fetch-current-prior', async () => {
      const db = await getD1();
      if (!db) {
        return { alpha: 2.0, beta: 2.0, sampleSize: 1 };
      }

      try {
        const row = await db
          .prepare(
            `SELECT alpha, beta, sample_size
             FROM growth_bayesian_priors
             WHERE user_id = ? AND dimension_key = ? AND dimension_val = ?`
          )
          .bind(userId, dimKey, dimVal)
          .first<{ alpha: number; beta: number; sample_size: number }>();

        if (row) {
          return {
            alpha: row.alpha,
            beta: row.beta,
            sampleSize: row.sample_size,
          };
        }
      } catch (err) {
        logger.warn('Failed to query current Bayesian prior, using uniform prior', { error: err });
      }

      return { alpha: 2.0, beta: 2.0, sampleSize: 1 };
    });

    // Step 2: Compute and persist updated conjugate prior with dampening
    const updateResult = await step.run('update-prior-persistence', async () => {
      const success = await updateBayesianPrior(userId, dimKey, dimVal, {
        currentAlpha: currentPrior.alpha,
        currentBeta: currentPrior.beta,
        sampleSize: currentPrior.sampleSize,
        observedScore: normalizedCompletionScore,
        dampeningFactor,
      });

      return { success };
    });

    return {
      userId,
      dimKey,
      dimVal,
      recalibrated: updateResult.success,
    };
  }
);

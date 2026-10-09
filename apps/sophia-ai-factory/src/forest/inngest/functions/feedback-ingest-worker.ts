/**
 * Forest Layer: Performance Feedback Ingest Inngest Function
 * Listens for social publishing telemetry events and triggers Bayesian prior updates.
 * Layer: forest/inngest/functions | Max LOC: < 200 | Zero :any
 * @module forest/inngest/functions/feedback-ingest-worker
 */

import { inngest } from '@/seed/inngest/client';
import { logger } from '@/seed/utils/logger-utility';
import {
  ingestPostPublishFeedback,
  updateBayesianPrior,
} from '@/land/growth-v15/feedback-coordinator';
import { PostPublishFeedbackSchema } from '@/seed/types/growth-triad-v15';
import { normalizeAudienceRetention } from '@/tree/growth-v15/audience-retention-normalizer';

export const performanceFeedbackIngestWorker = inngest.createFunction(
  {
    id: 'growth-v15-feedback-ingest-worker',
    name: 'Growth v15 Performance Feedback Ingestion',
    concurrency: 5,
  },
  { event: 'growth/v15.feedback.ingest' },
  async ({ event, step }) => {
    const parsed = PostPublishFeedbackSchema.safeParse(event.data);
    if (!parsed.success) {
      logger.error('Invalid feedback payload received by inngest function', {
        errors: parsed.error.issues,
      });
      return { success: false, reason: 'INVALID_PAYLOAD' };
    }

    const feedback = parsed.data;

    // Step 1: Ingest feedback record to D1
    const ingested = await step.run('persist-feedback', async () => {
      return ingestPostPublishFeedback(feedback);
    });

    if (!ingested) {
      return { success: false, reason: 'INGESTION_FAILED' };
    }

    // Step 2: Compute retention metrics and update Bayesian priors
    await step.run('update-priors', async () => {
      const { normalizedCompletionScore } = normalizeAudienceRetention(
        feedback.retentionCurve
      );

      // Update dimension prior for platform
      await updateBayesianPrior(
        feedback.userId,
        'platform',
        feedback.platform,
        {
          currentAlpha: 1.0,
          currentBeta: 1.0,
          sampleSize: feedback.views,
          observedScore: normalizedCompletionScore,
          dampeningFactor: 0.85,
        }
      );

      return { priorsUpdated: true };
    });

    return { success: true, feedbackId: feedback.id };
  }
);

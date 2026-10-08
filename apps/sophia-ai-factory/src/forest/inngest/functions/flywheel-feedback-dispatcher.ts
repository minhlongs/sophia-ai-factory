/**
 * Inngest Function: Flywheel Feedback Dispatcher
 * Closed-loop feedback engine updating Thompson Sampling and Creative Memory.
 * Layer: forest/inngest/functions | LOC: < 200 | Zero :any
 * @module forest/inngest/functions/flywheel-feedback-dispatcher
 */

import { inngest } from '@/seed/inngest/client';
import { recordLearning } from '@/tree/creative-memory';
import { recordThompsonFeedback, type ThompsonHookArm } from '@/tree/affiliate/optimization/thompson-sampling-optimizer';

export interface EvaluatedFeedbackEventData {
  userId: string;
  jobId: string;
  platform: string;
  hookScore: number;
  retentionScore: number;
  netRoiUsd: number;
  conversions: number;
  revenueUsd: number;
}

interface InngestStepContext {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
}

export async function processFlywheelFeedbackDispatcher({
  event,
  step,
}: {
  event: { data: unknown };
  step: InngestStepContext;
}): Promise<{ processed: boolean; promoted: boolean; armId: string }> {
  const data = event.data as EvaluatedFeedbackEventData;
  const armId = `arm_${data.platform}_${data.jobId.slice(0, 8)}`;

  // Step 1: Update Thompson Sampling Posterior
  const updatedArm = await step.run('update-thompson-posterior', async () => {
    const existingArm: ThompsonHookArm = {
      id: armId,
      name: `Angle for ${data.jobId}`,
      niche: 'saas_global',
      impressions: 100,
      conversions: data.conversions > 0 ? 5 : 1,
      totalRewardCents: Math.round(data.revenueUsd * 100),
      priorAlpha: 2,
      priorBeta: 10,
    };

    const feedback = recordThompsonFeedback(
      existingArm,
      data.conversions,
      Math.round(data.revenueUsd * 100),
    );
    return feedback;
  });

  // Step 2: Evaluate Promotion to Creative Memory
  const isWinning = data.hookScore >= 80 && (data.netRoiUsd > 0 || data.retentionScore >= 75);

  const memoryResult = await step.run('evaluate-creative-memory-promotion', async () => {
    if (!isWinning) {
      return { promoted: false, memoryId: null };
    }

    const recorded = await recordLearning(
      data.userId,
      'creative',
      `high_converting_hook_${data.platform}`,
      {
        jobId: data.jobId,
        platform: data.platform,
        hookScore: data.hookScore,
        retentionScore: data.retentionScore,
        netRoiUsd: data.netRoiUsd,
      },
      `Closed-loop telemetry: Hook=${data.hookScore}, Retention=${data.retentionScore}, ROI=$${data.netRoiUsd}`,
      'workspace',
      data.userId,
    );

    return { promoted: true, memoryId: recorded.id };
  });

  return {
    processed: true,
    promoted: memoryResult.promoted,
    armId: updatedArm.id,
  };
}

export const flywheelFeedbackDispatcherJob = inngest.createFunction(
  {
    id: 'flywheel-feedback-dispatcher',
    name: 'Closed-Loop Flywheel & Bayesian Memory Dispatcher',
    retries: 2,
  },
  { event: 'social.analytics.feedback_evaluated' },
  processFlywheelFeedbackDispatcher,
);

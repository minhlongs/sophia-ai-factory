/**
 * Forest Layer: Growth Triad v14 Predictive Render Inngest Functions
 * Orchestrates Kelly-backed render pipelines and Bayesian Stage 1 early-halt evaluations.
 * Layer: forest/growth-v14 | Max LOC: < 200 | Zero :any
 * @module forest/growth-v14/predictive-render-worker
 */

import { inngest } from '@/seed/inngest/client';
import { NonRetriableError } from 'inngest';
import { evaluateEarlyHaltSurvival } from '@/tree/growth-v14/survival-halt-predictor';
import { logger } from '@/seed/utils/logger-utility';
import { updateJobStatusInD1 } from '@/seed/db/predictive-render-ops';

export const predictiveRenderScheduleJob = inngest.createFunction(
  {
    id: 'growth-v14-render-schedule',
    name: 'Growth Triad v14: Predictive Render Scheduler',
    retries: 2,
  },
  { event: 'growth/v14.render.schedule' },
  async ({ event, step }) => {
    const { jobId, userId, scriptId, allocatedMcu, deliberationScore } = event.data;

    if (!jobId || !userId || !scriptId) {
      throw new NonRetriableError('Missing required job parameters for scheduling');
    }

    logger.info('Growth v14: Scheduling predictive render job', {
      jobId,
      userId,
      allocatedMcu,
      deliberationScore,
    });

    // Step 1: Transition status in DB
    await step.run('set-stage-1-rendering-status', async () => {
      await updateJobStatusInD1(jobId, 'STAGE_1_RENDERING', 0);
    });

    // Step 2: Trigger downstream stage 1 synthesis evaluation trigger
    await step.sendEvent('send-stage-1-evaluation', {
      name: 'growth/v14.render.stage1_evaluate',
      data: {
        jobId,
        userId,
        interimRetentionScore: 0.85, // Default expectation, overridden in live synthesis
      },
    });

    return { jobId, status: 'STAGE_1_RENDERING' };
  }
);

export const predictiveRenderEvaluateJob = inngest.createFunction(
  {
    id: 'growth-v14-render-stage1-evaluate',
    name: 'Growth Triad v14: Bayesian Stage 1 Survival Evaluator',
    retries: 2,
  },
  { event: 'growth/v14.render.stage1_evaluate' },
  async ({ event, step }) => {
    const { jobId, userId, interimRetentionScore } = event.data;

    if (!jobId || !userId) {
      throw new NonRetriableError('Missing jobId or userId for evaluation');
    }

    // Step 1: Evaluate Bayesian survival
    const survivalDecision = await step.run('evaluate-survival', async () => {
      return evaluateEarlyHaltSurvival({
        interimRetentionScore,
        priorAlpha: 2.0,
        priorBeta: 2.0,
        sampleSize: 20,
        criticalCutoffPercentile: 0.25,
      });
    });

    // Step 2: Act on decision
    if (survivalDecision.shouldHalt) {
      logger.warn('Growth v14: Early halt triggered', {
        jobId,
        reason: survivalDecision.reason,
        savingsPct: survivalDecision.projectedMcuSavingsPct,
      });

      await step.run('persist-halt-status', async () => {
        await updateJobStatusInD1(
          jobId,
          'HALTED_EARLY',
          undefined,
          survivalDecision.retentionPercentile,
          survivalDecision.reason
        );
      });

      await step.sendEvent('emit-render-halt', {
        name: 'growth/v14.render.halt',
        data: {
          jobId,
          userId,
          reason: survivalDecision.reason,
          savedMcu: Math.floor(100 * (survivalDecision.projectedMcuSavingsPct / 100)),
        },
      });

      return { jobId, halted: true, decision: survivalDecision };
    }

    // Otherwise approve for full render completion
    await step.run('persist-completion-status', async () => {
      await updateJobStatusInD1(
        jobId,
        'COMPLETED',
        undefined,
        survivalDecision.retentionPercentile
      );
    });

    return { jobId, halted: false, decision: survivalDecision };
  }
);

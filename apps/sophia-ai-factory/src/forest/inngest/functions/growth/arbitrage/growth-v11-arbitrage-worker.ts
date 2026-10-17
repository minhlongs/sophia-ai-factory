/**
 * @file growth-v11-arbitrage-worker.ts
 * @description Inngest function handlers for Growth Triad v11 arbitrage and opportunistic scheduler cron
 */

import { inngest } from '@/seed/inngest/client';
import { NonRetriableError } from 'inngest';
import { logger } from '@/seed/utils/logger-utility';
import { evaluateComputeArbitrage } from '@/tree/growth-v11/compute-arbitrage';
import type { ComputeJobRecord } from '@/forest/growth/opportunistic-scheduler';
import type {
  ArbitrageRequestedPayload,
  ArbitrageWorkerResult,
} from './types';
import { evaluateViralityAndHooks } from './niche-evaluator';
import { persistArbitrageDecision, spawnComputeJob } from './campaign-spawner';
import {
  growthV11SchedulerCron,
  verifyArbitrageCircuitBreaker,
} from './growth-v11-scheduler-cron';

export { growthV11SchedulerCron, verifyArbitrageCircuitBreaker };

export const growthV11ArbitrageWorker = inngest.createFunction(
  {
    id: 'growth-v11-arbitrage-worker',
    name: 'Growth Triad v11 - Cross-Platform Arbitrage Worker',
    retries: 3,
    concurrency: {
      limit: 10,
      key: 'event.data.userId',
    },
  },
  { event: 'growth.v11.arbitrage_requested' },
  async ({ event, step }) => {
    const data = event.data as unknown as ArbitrageRequestedPayload;
    const { videoId, userId, primaryPlatform, targetPlatforms, metrics, originalHookText } =
      data || {};

    if (!videoId || !userId || !primaryPlatform || !metrics || !originalHookText) {
      throw new NonRetriableError('Missing required fields for growth-v11 arbitrage execution.');
    }

    const durationSeconds = data.durationSeconds ?? 60;
    const velocityScore = data.velocityScore ?? 50;
    const userTier = data.userTier ?? 'BASIC';
    const currentHourUtc = new Date().getUTCHours();
    const decisionId = `arb_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const computeJobId = `job_${videoId}_${Date.now()}`;

    // Step 1: Upstream Circuit Breaker Check
    await step.run('verify-provider-circuit-breakers', async () => {
      return verifyArbitrageCircuitBreaker();
    });

    // Step 2: Compute Mathematical Virality & Hook Alignment
    const evaluation = await step.run('evaluate-virality-and-hooks', async () => {
      return evaluateViralityAndHooks({
        videoId,
        primaryPlatform,
        targetPlatforms,
        metrics,
        originalHookText,
      });
    });

    // Step 3: Compute Model & Execution Arbitrage
    const computeArbitrage = await step.run('evaluate-compute-arbitrage', async () => {
      return evaluateComputeArbitrage(
        {
          durationSeconds,
          isHighVelocity: velocityScore >= 75,
          allowDeferred: velocityScore < 75,
        },
        currentHourUtc,
      );
    });

    // Step 4: Persist Arbitrage Decision in D1
    await step.run('persist-arbitrage-decision-d1', async () => {
      return persistArbitrageDecision({
        decisionId,
        videoId,
        userId,
        primaryPlatform,
        targetPlatforms,
        evaluation,
      });
    });

    // Step 5: Enqueue Compute Job with Off-Peak Routing
    const enqueuedJob: ComputeJobRecord = await step.run('enqueue-compute-job', async () => {
      return spawnComputeJob({
        computeJobId,
        videoId,
        userTier,
        velocityScore,
        durationSeconds,
        isOffPeak: computeArbitrage.isOffPeak,
      });
    });

    logger.info('[GrowthV11ArbitrageWorker] Decision processed', {
      decisionId,
      videoId,
      computeJobId,
      priority: enqueuedJob.priority,
    });

    const status =
      enqueuedJob.status === 'QUEUED' ? 'QUEUED_FOR_OFFPEAK' : 'COMPLETED';

    const result: ArbitrageWorkerResult = {
      status,
      decisionId,
      videoId,
      primaryScore: evaluation.primaryScore,
      syndicationCount: evaluation.hookMutations.length,
      computeJobId: enqueuedJob.jobId,
      priorityLane: computeArbitrage.priorityLane,
      estimatedSavingsUsd: computeArbitrage.savingsUsd,
    };

    return result;
  },
);

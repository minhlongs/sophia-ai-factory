/**
 * @file growth-v11-arbitrage-worker.ts
 * @description Inngest function handlers for Growth Triad v11 arbitrage and opportunistic scheduler cron
 */

import { inngest } from '@/seed/inngest/client';
import { NonRetriableError } from 'inngest';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { recordSuccess, recordFailure, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';
import { evaluateComputeArbitrage } from '@/tree/growth-v11/compute-arbitrage';
import {
  coordinateBatchQueue,
  type ComputeJobRecord,
  type QueueCoordinationResult,
} from '@/forest/growth/opportunistic-scheduler';
import type {
  ArbitrageRequestedPayload,
  ArbitrageWorkerResult,
  BatchSchedulerCronResult,
} from './types';
import { evaluateViralityAndHooks } from './niche-evaluator';
import { persistArbitrageDecision, spawnComputeJob } from './campaign-spawner';

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
    const { videoId, userId, primaryPlatform, targetPlatforms, metrics, originalHookText } = data || {};

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
      const allowed = shouldAllowRequest('growth-v11-arbitrage-engine');
      if (!allowed) {
        throw new Error('Circuit breaker is OPEN for growth-v11-arbitrage-engine.');
      }
      try {
        recordSuccess('growth-v11-arbitrage-engine');
        return { ok: true };
      } catch (err) {
        recordFailure('growth-v11-arbitrage-engine', FailureKind.SERVER_ERROR);
        throw err;
      }
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

export const growthV11SchedulerCron = inngest.createFunction(
  {
    id: 'growth-v11-scheduler-cron',
    name: 'Growth Triad v11 - Opportunistic Compute Scheduler Cron',
    retries: 2,
  },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    const result: QueueCoordinationResult = await step.run('coordinate-offpeak-queues', async () => {
      const db = createServerClient().unwrap();
      const coordRes = await coordinateBatchQueue(db);
      if (!coordRes.ok) {
        throw new Error(`Failed to coordinate batch queue: ${coordRes.error.message}`);
      }
      return coordRes.value;
    });

    logger.info('[GrowthV11SchedulerCron] Batch queue synchronized', {
      isOffPeak: result.isOffPeak,
      promoted: result.promotedCount,
      leased: result.leasedCount,
      dispatched: result.dispatchedCount,
    });

    const cronOutput: BatchSchedulerCronResult = {
      status: 'SUCCESS',
      isOffPeak: result.isOffPeak,
      promotedCount: result.promotedCount,
      leasedCount: result.leasedCount,
      dispatchedCount: result.dispatchedCount,
      heldInQueueCount: result.heldInQueueCount,
    };

    return cronOutput;
  },
);

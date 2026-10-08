/**
 * @file growth-v11-arbitrage-worker.ts
 * @description Inngest background worker executing Growth Triad v11 arbitrage tasks:
 * 1. Arbitrage requested: evaluates virality & compute, records D1 decisions, enqueues compute jobs.
 * 2. Cron/Batch triggered: runs opportunistic scheduler to coordinate off-peak queues and dispatch renders.
 * @layer forest
 */

import { inngest } from '@/seed/inngest/client';
import { NonRetriableError } from 'inngest';
import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { recordSuccess, recordFailure, shouldAllowRequest } from '@/seed/security/circuit-breaker';
import { FailureKind } from '@/seed/types/failure-kind';
import {
  calculatePlatformViralityScore,
  calculateHookDivergence,
  mutatePlatformHook,
  type ViralityMetrics,
} from '@/tree/growth-v11/virality-arbitrage';
import {
  evaluateComputeArbitrage,
} from '@/tree/growth-v11/compute-arbitrage';
import {
  coordinateBatchQueue,
  enqueueComputeJob,
  type ComputeJobRecord,
  type QueueCoordinationResult,
} from '@/forest/growth/opportunistic-scheduler';
import type {
  SupportedPlatform,
  SophiaTier,
  PlatformMetricProfile,
  PlatformArbitrageScore,
  HookMutationRequest,
  ComputeModelTier,
  ComputePriority,
  ArbitrageRecommendation,
} from '@/seed/types/growth-triad-v11';

// ============================================================================
// Types
// ============================================================================

export interface ArbitrageRequestedPayload {
  videoId: string;
  userId: string;
  userTier?: SophiaTier;
  primaryPlatform: SupportedPlatform;
  targetPlatforms: SupportedPlatform[];
  metrics: PlatformMetricProfile;
  originalHookText: string;
  durationSeconds?: number;
  velocityScore?: number;
}

export interface ArbitrageWorkerResult {
  status: 'COMPLETED' | 'QUEUED_FOR_OFFPEAK' | 'FAILED';
  decisionId: string;
  videoId: string;
  primaryScore: number;
  syndicationCount: number;
  computeJobId: string;
  priorityLane: string;
  estimatedSavingsUsd: number;
}

export interface BatchSchedulerCronResult {
  status: 'SUCCESS';
  isOffPeak: boolean;
  promotedCount: number;
  leasedCount: number;
  dispatchedCount: number;
  heldInQueueCount: number;
}

function extractMetricsForPlatform(
  platform: SupportedPlatform,
  profile: PlatformMetricProfile
): ViralityMetrics {
  switch (platform) {
    case 'TIKTOK':
      return {
        completionRate: profile.tiktok?.completionRate ?? 0.6,
        rewatchRate: profile.tiktok?.rewatchRate ?? 0.2,
        shareRate: profile.tiktok?.shareRate ?? 0.1,
        retentionAt3s: profile.tiktok?.retentionAt3s ?? 0.7,
        likeRate: profile.tiktok?.likeRate ?? 0.05,
        commentRate: profile.tiktok?.commentRate ?? 0.02,
      };
    case 'YOUTUBE_SHORTS':
      return {
        viewedVsSwipedRate: profile.youtubeShorts?.viewedVsSwipedRate ?? 0.75,
        completionRate: profile.youtubeShorts?.completionRate ?? 0.65,
        likeRate: profile.youtubeShorts?.engagementLikes ?? 0.05,
      };
    case 'INSTAGRAM_REELS':
      return {
        dmShareRate: profile.instagramReels?.directMessageShareRate ?? 0.15,
        saveRate: profile.instagramReels?.saveRate ?? 0.1,
        completionRate: profile.instagramReels?.completionRate ?? 0.55,
        likeRate: profile.instagramReels?.likeRate ?? 0.05,
      };
    default:
      return {};
  }
}

// ============================================================================
// Event Handlers / Inngest Functions
// ============================================================================

/**
 * Inngest function listening for growth.v11.arbitrage_requested
 */
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
      const primaryMetrics = extractMetricsForPlatform(primaryPlatform, metrics);
      const primaryRawScore = calculatePlatformViralityScore(primaryPlatform, primaryMetrics);
      const primaryScorePercent = Math.min(100, Math.round(primaryRawScore * 100));

      const syndicationRecommendations: PlatformArbitrageScore[] = [];
      for (const destPlatform of targetPlatforms || []) {
        if (destPlatform !== primaryPlatform) {
          const destMetrics = extractMetricsForPlatform(destPlatform, metrics);
          const rawScore = calculatePlatformViralityScore(destPlatform, destMetrics);
          const scorePercent = Math.min(100, Math.round(rawScore * 100));
          const expectedMultiplier = Number((rawScore / Math.max(0.1, primaryRawScore)).toFixed(2));
          const recommendation: ArbitrageRecommendation =
            scorePercent >= 70 ? 'SYNDICATE' : scorePercent >= 40 ? 'HOLD' : 'SKIP';

          syndicationRecommendations.push({
            platform: destPlatform,
            viralityScore: scorePercent,
            expectedMultiplier: Math.max(0.1, expectedMultiplier),
            confidenceScore: 0.88,
            retentionIndex: Math.min(100, Math.round(scorePercent * 0.95)),
            engagementIndex: Math.min(100, Math.round(scorePercent * 1.05)),
            recommendation,
            reasoning: `Predicted ${destPlatform} multiplier ${expectedMultiplier}x relative to primary ${primaryPlatform}.`,
          });
        }
      }

      const hookMutations: HookMutationRequest[] = [];
      const sourceTokens = originalHookText.split(/\s+/);
      for (const destPlatform of targetPlatforms || []) {
        if (destPlatform !== primaryPlatform) {
          const mutation = mutatePlatformHook(originalHookText, [], destPlatform);
          const targetTokens = mutation.mutatedTitle.split(/\s+/);
          const divergence = calculateHookDivergence(sourceTokens, targetTokens);
          hookMutations.push({
            mutationId: `mut_${Date.now()}_${destPlatform.toLowerCase()}`,
            videoId,
            sourcePlatform: primaryPlatform,
            targetPlatform: destPlatform,
            originalHookText,
            mutatedHookText: mutation.mutatedTitle,
            divergenceScore: divergence,
            strategy: 'CURIOSITY_PUNCH',
            metadataTransform: {
              removeWatermarkMarkers: true,
              stripExifMetadata: true,
              normalizeAudioLufs: -14.0,
              targetPacingWpm: 185,
            },
          });
        }
      }

      return {
        primaryScore: primaryScorePercent,
        syndicationRecommendations,
        hookMutations,
      };
    });

    // Step 3: Compute Model & Execution Arbitrage
    const computeArbitrage = await step.run('evaluate-compute-arbitrage', async () => {
      return evaluateComputeArbitrage(
        {
          durationSeconds,
          isHighVelocity: velocityScore >= 75,
          allowDeferred: velocityScore < 75,
        },
        currentHourUtc
      );
    });

    // Step 4: Persist Arbitrage Decision in D1
    await step.run('persist-arbitrage-decision-d1', async () => {
      const db = createServerClient().unwrap();
      const nowSec = Math.floor(Date.now() / 1000);
      const scoresRecord: Record<string, PlatformArbitrageScore> = {
        [primaryPlatform]: {
          platform: primaryPlatform,
          viralityScore: evaluation.primaryScore,
          expectedMultiplier: 1.0,
          confidenceScore: 0.95,
          retentionIndex: evaluation.primaryScore,
          engagementIndex: evaluation.primaryScore,
          recommendation: 'PRIMARY_TARGET',
          reasoning: `Primary launch channel on ${primaryPlatform}`,
        },
      };
      for (const synd of evaluation.syndicationRecommendations) {
        scoresRecord[synd.platform] = synd;
      }

      const insertQuery = `
        INSERT INTO growth_v11_arbitrage_logs (
          id, decision_id, video_id, user_id, primary_platform,
          syndication_platforms_json, scores_json, hook_mutations_json,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(decision_id) DO UPDATE SET
          status = excluded.status,
          updated_at = excluded.updated_at
      `;

      await db
        .prepare(insertQuery)
        .bind(
          `log_${decisionId}`,
          decisionId,
          videoId,
          userId,
          primaryPlatform,
          JSON.stringify(targetPlatforms || []),
          JSON.stringify(scoresRecord),
          JSON.stringify(evaluation.hookMutations),
          'APPROVED',
          nowSec,
          nowSec
        )
        .run();

      return { persisted: true, decisionId };
    });

    // Step 5: Enqueue Compute Job with Off-Peak Routing
    const enqueuedJob: ComputeJobRecord = await step.run('enqueue-compute-job', async () => {
      const db = createServerClient().unwrap();
      const targetModelTier: ComputeModelTier =
        velocityScore >= 75
          ? 'PHOTOREAL_EXPENSIVE'
          : computeArbitrage.isOffPeak
          ? 'STANDARD_BALANCED'
          : 'ECONOMY_DEGRADED';
      const priority: ComputePriority =
        velocityScore >= 75 ? 'IMMEDIATE_PREMIUM' : 'OFF_PEAK_ECONOMIC';

      const res = await enqueueComputeJob(db, {
        jobId: computeJobId,
        videoId,
        userTier,
        velocityScore,
        priority,
        targetModelTier,
        durationSeconds,
      });

      if (!res.ok) {
        throw new Error(res.error.message);
      }
      return res.value;
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
  }
);

/**
 * Cron trigger function running every 15 minutes to coordinate off-peak queues
 */
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
  }
);

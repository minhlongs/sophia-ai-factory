/**
 * @file campaign-spawner.ts
 * @description Persists D1 arbitrage logs and enqueues compute jobs for off-peak routing
 */

import { createServerClient } from '@/seed/db/client';
import {
  enqueueComputeJob,
  type ComputeJobRecord,
} from '@/forest/growth/opportunistic-scheduler';
import type {
  SupportedPlatform,
  SophiaTier,
  PlatformArbitrageScore,
  ComputeModelTier,
  ComputePriority,
} from '@/seed/types/growth-triad-v11';
import type { ViralityEvaluationResult } from './types';

export async function persistArbitrageDecision(params: {
  decisionId: string;
  videoId: string;
  userId: string;
  primaryPlatform: SupportedPlatform;
  targetPlatforms: SupportedPlatform[];
  evaluation: ViralityEvaluationResult;
}): Promise<{ persisted: boolean; decisionId: string }> {
  const { decisionId, videoId, userId, primaryPlatform, targetPlatforms, evaluation } = params;
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
      nowSec,
    )
    .run();

  return { persisted: true, decisionId };
}

export async function spawnComputeJob(params: {
  computeJobId: string;
  videoId: string;
  userTier: SophiaTier;
  velocityScore: number;
  durationSeconds: number;
  isOffPeak: boolean;
}): Promise<ComputeJobRecord> {
  const { computeJobId, videoId, userTier, velocityScore, durationSeconds, isOffPeak } = params;
  const db = createServerClient().unwrap();

  const targetModelTier: ComputeModelTier =
    velocityScore >= 75
      ? 'PHOTOREAL_EXPENSIVE'
      : isOffPeak
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
}

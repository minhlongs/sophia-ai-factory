/**
 * Land Layer: Flywheel Lifecycle Coordinator
 * Manages D1 persistence for autonomous reseed jobs and conversion attribution ledger.
 * Layer: land/growth | Max LOC: < 200 | Zero :any
 * @module land/growth/flywheel-coordinator
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ReseedJobStatus,
  FlywheelSummaryStats,
  VideoViralityClass,
} from '@/seed/types/growth-triad-v12';

export interface CreateReseedJobInput {
  id: string;
  userId: string;
  sourceJobId: string;
  channelId: string;
  platform: string;
  retentionZScore: number;
  classification: VideoViralityClass;
  originalHook: string;
  mutatedHooks: string[];
}

export interface ReseedJobRecord {
  id: string;
  userId: string;
  sourceJobId: string;
  channelId: string;
  platform: string;
  retentionZScore: number;
  classification: string;
  originalHook: string;
  mutatedHooks: string[];
  status: ReseedJobStatus;
  reseededCampaignId?: string | null;
  createdAt: number;
}

export async function createReseedJob(input: CreateReseedJobInput): Promise<boolean> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for createReseedJob');
    return false;
  }
  const now = Date.now();

  try {
    const res = await db
      .prepare(
        `INSERT INTO flywheel_reseed_jobs (
          id, user_id, source_job_id, channel_id, platform,
          retention_zscore, classification, original_hook, mutated_hooks_json,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?)
        ON CONFLICT (id) DO NOTHING`,
      )
      .bind(
        input.id,
        input.userId,
        input.sourceJobId,
        input.channelId,
        input.platform,
        input.retentionZScore,
        input.classification,
        input.originalHook,
        JSON.stringify(input.mutatedHooks),
        now,
        now,
      )
      .run();

    return (res.meta?.changes ?? 0) > 0;
  } catch (err) {
    logger.error('Failed to create flywheel reseed job', { error: err });
    return false;
  }
}

export async function updateReseedJobStatus(
  jobId: string,
  status: ReseedJobStatus,
  reseededCampaignId?: string,
): Promise<boolean> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for updateReseedJobStatus');
    return false;
  }
  const now = Date.now();

  try {
    const res = await db
      .prepare(
        `UPDATE flywheel_reseed_jobs
         SET status = ?, reseeded_campaign_id = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(status, reseededCampaignId ?? null, now, jobId)
      .run();

    return (res.meta?.changes ?? 0) > 0;
  } catch (err) {
    logger.error('Failed to update reseed job status', { jobId, error: err });
    return false;
  }
}

export async function getFlywheelSummaryStats(userId: string): Promise<FlywheelSummaryStats> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for getFlywheelSummaryStats');
    return {
      totalReseedJobs: 0,
      alphaViralDetected: 0,
      reseededCount: 0,
      totalAttributedRevenueUsd: 0,
      totalCommissionUsd: 0,
    };
  }

  try {
    const jobStats = await db
      .prepare(
        `SELECT
          COUNT(*) as totalJobs,
          SUM(CASE WHEN classification = 'ALPHA_VIRAL' THEN 1 ELSE 0 END) as alphaCount,
          SUM(CASE WHEN status = 'RESEEDED' THEN 1 ELSE 0 END) as reseededCount
         FROM flywheel_reseed_jobs
         WHERE user_id = ?`,
      )
      .bind(userId)
      .first<{ totalJobs: number; alphaCount: number; reseededCount: number }>();

    const attrStats = await db
      .prepare(
        `SELECT
          COALESCE(SUM(gross_amount_usd), 0) as totalGross,
          COALESCE(SUM(commission_amount_usd), 0) as totalCommission
         FROM conversion_attributions
         WHERE user_id = ?`,
      )
      .bind(userId)
      .first<{ totalGross: number; totalCommission: number }>();

    return {
      totalReseedJobs: jobStats?.totalJobs ?? 0,
      alphaViralDetected: jobStats?.alphaCount ?? 0,
      reseededCount: jobStats?.reseededCount ?? 0,
      totalAttributedRevenueUsd: attrStats?.totalGross ?? 0,
      totalCommissionUsd: attrStats?.totalCommission ?? 0,
    };
  } catch (err) {
    logger.error('Failed to aggregate flywheel summary stats', { userId, error: err });
    return {
      totalReseedJobs: 0,
      alphaViralDetected: 0,
      reseededCount: 0,
      totalAttributedRevenueUsd: 0,
      totalCommissionUsd: 0,
    };
  }
}

/**
 * Land Layer: Flywheel Lifecycle Coordinator
 * Manages D1 persistence for autonomous reseed jobs and conversion attribution ledger.
 * Layer: land/growth | Max LOC: < 200 | Zero :any
 * @module land/growth/flywheel-coordinator
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { acquireCasLock, releaseCasLock } from '@/seed/db/atomic-cas-lock';
import type {
  ReseedJobStatus,
  VideoViralityClass,
} from '@/seed/types/growth-triad-v12';

export { getFlywheelSummaryStats } from './flywheel-summary-stats';

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

export async function acquireReseedLock(jobId: string, workerId: string): Promise<boolean> {
  const res = await acquireCasLock(`reseed:job:${jobId}`, workerId);
  return res.acquired;
}

export async function releaseReseedLock(jobId: string, workerId: string): Promise<boolean> {
  return releaseCasLock(`reseed:job:${jobId}`, workerId);
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

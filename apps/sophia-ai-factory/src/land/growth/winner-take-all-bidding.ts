/**
 * Winner-Take-All (WTA) Bidding Evaluation & Execution
 *
 * Joins `video_jobs` with `video_analytics`, scores published videos by measured
 * engagement, holds on sparse cohorts (`< 5` jobs or Track B Sparse-Data Hold),
 * culls bottom 80% via parameterized SQL, and duplicates top 20%.
 *
 * Layer: land/growth
 * @module land/growth/winner-take-all-bidding
 */

import { enforceCommercialFeatureForUser } from '@/seed/config/enforce-commercial-feature-server';
import { createServerClient } from '@/seed/db/client';
import { inngest } from '@/seed/inngest/client';
import { failure, success, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { probeUserSparseDataFromD1 } from '@/land/growth-v14/predictive-render-sparse-probe';
import type { SparseDataGateInput } from '@/tree/growth/sparse-data-growth-guard';
import {
  SELECT_WTA_TELEMETRY_SQL,
  cullBottomWtaJobsInChunks,
} from './wta-bidding-sql';
import {
  evaluateWtaBiddingHold,
  rankWtaJobsByTelemetry,
  type WtaJobTelemetryRow,
} from './wta-telemetry-scorer';

export type ErrorResponse = { code: string; message: string };

export interface WtaBiddingResult {
  culledCount: number;
  duplicatedCount: number;
  batchId: string;
  heldBySparseData?: boolean;
}

export async function executeWinnerTakeAllBidding(params: {
  tenantId: string;
  userId: string;
  campaignDateRangeStart: number;
  campaignDateRangeEnd: number;
  sparseData?: SparseDataGateInput;
}): Promise<Result<WtaBiddingResult, ErrorResponse>> {
  try {
    const { tenantId, userId, campaignDateRangeStart, campaignDateRangeEnd, sparseData } = params;

    const gate = await enforceCommercialFeatureForUser(userId, 'growth_triad_bandit_kelly');
    if (!gate.ok) {
      return failure({ code: 'FEATURE_LOCKED', message: gate.error.message });
    }

    const db = createServerClient();
    const jobsSnapshot = await db
      .prepare(SELECT_WTA_TELEMETRY_SQL)
      .bind(tenantId, userId, campaignDateRangeStart, campaignDateRangeEnd)
      .all<WtaJobTelemetryRow>();

    if (!jobsSnapshot.success || !jobsSnapshot.results) {
      return failure({
        code: 'DB_ERROR',
        message: 'Failed to fetch video jobs and telemetry for bidding evaluation',
      });
    }

    const jobs = jobsSnapshot.results;
    const batchId = `wta_${Date.now()}`;
    const probedSparseData = await probeUserSparseDataFromD1(userId, undefined, tenantId);
    if (
      evaluateWtaBiddingHold(jobs.length, probedSparseData).hold ||
      evaluateWtaBiddingHold(jobs.length, sparseData).hold
    ) {
      return success({ culledCount: 0, duplicatedCount: 0, batchId, heldBySparseData: true });
    }

    const rankedJobs = rankWtaJobsByTelemetry(jobs);
    const topCount = Math.max(1, Math.floor(rankedJobs.length * 0.2));
    const topJobs = rankedJobs.slice(0, topCount);
    const bottomJobs = rankedJobs.slice(topCount);

    if (topJobs.length > 0) {
      const events = topJobs.map((job) => ({
        name: 'video/generate.requested' as const,
        data: {
          missionId: `${batchId}_${job.id}`,
          tenantId,
          userId,
          prompt: job.prompt,
          voiceoverText: job.prompt,
          language: 'vi' as const,
        },
      }));
      await inngest.send(events);
    }

    if (bottomJobs.length > 0) {
      await cullBottomWtaJobsInChunks(
        db,
        tenantId,
        bottomJobs.map((job) => job.id),
        Math.floor(Date.now() / 1000),
      );
    }

    return success({ culledCount: bottomJobs.length, duplicatedCount: topJobs.length, batchId });
  } catch (err) {
    logger.error(
      '[winner-take-all-bidding] Failed to evaluate WTA campaign bidding',
      err instanceof Error ? err : undefined,
    );
    return failure({
      code: 'WTA_EVAL_ERROR',
      message: 'Failed to evaluate Winner-Take-All campaign bidding',
    });
  }
}

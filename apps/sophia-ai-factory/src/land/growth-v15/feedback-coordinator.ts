/**
 * Land Layer: Growth Triad v15 Feedback Coordinator
 * Manages D1 persistence for post-publish telemetry and conjugate prior state.
 * Layer: land/growth-v15 | Max LOC: < 200 | Zero :any
 * @module land/growth-v15/feedback-coordinator
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  PostPublishFeedback,
  ConjugatePriorUpdateInput,
  BayesianFeedbackSummary,
} from '@/seed/types/growth-triad-v15';
import { normalizeAudienceRetention } from '@/tree/growth-v15/audience-retention-normalizer';
import { updateConjugatePrior } from '@/tree/growth-v15/prior-updater';

export async function ingestPostPublishFeedback(
  feedback: PostPublishFeedback
): Promise<boolean> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for ingestPostPublishFeedback');
    return false;
  }

  const { normalizedCompletionScore, hookDropoffRate } =
    normalizeAudienceRetention(feedback.retentionCurve);
  const now = Date.now();

  try {
    const res = await db
      .prepare(
        `INSERT INTO growth_post_publish_feedback (
          id, user_id, video_manifest_id, channel_id, platform,
          views, impressions, watch_time_seconds, duration_seconds,
          retention_curve_json, ctr, virality_score,
          normalized_completion_score, hook_dropoff_rate,
          collected_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO NOTHING`
      )
      .bind(
        feedback.id,
        feedback.userId,
        feedback.videoManifestId,
        feedback.channelId,
        feedback.platform,
        feedback.views,
        feedback.impressions ?? 0,
        feedback.watchTimeSeconds,
        feedback.durationSeconds,
        JSON.stringify(feedback.retentionCurve),
        feedback.ctr ?? 0,
        feedback.viralityScore ?? 0,
        normalizedCompletionScore,
        hookDropoffRate,
        feedback.collectedAt,
        now
      )
      .run();

    return (res.meta?.changes ?? 0) > 0;
  } catch (err) {
    logger.error('Failed to ingest post-publish feedback in D1', { error: err });
    return false;
  }
}

export async function updateBayesianPrior(
  userId: string,
  dimKey: string,
  dimVal: string,
  input: ConjugatePriorUpdateInput
): Promise<boolean> {
  const db = await getD1();
  if (!db) {
    logger.warn('D1 database unavailable for updateBayesianPrior');
    return false;
  }

  const updated = updateConjugatePrior(input);
  const now = Date.now();
  const id = `prior_${userId}_${dimKey}_${dimVal}`;

  try {
    const res = await db
      .prepare(
        `INSERT INTO growth_bayesian_priors (
          id, user_id, dimension_key, dimension_val, alpha, beta, sample_size, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, dimension_key, dimension_val)
        DO UPDATE SET
          alpha = excluded.alpha,
          beta = excluded.beta,
          sample_size = sample_size + 1,
          updated_at = excluded.updated_at`
      )
      .bind(
        id,
        userId,
        dimKey,
        dimVal,
        updated.updatedAlpha,
        updated.updatedBeta,
        1,
        now
      )
      .run();

    return (res.meta?.changes ?? 0) > 0;
  } catch (err) {
    logger.error('Failed to update Bayesian prior in D1', { error: err });
    return false;
  }
}

export async function getFeedbackSummary(
  userId: string
): Promise<BayesianFeedbackSummary> {
  const db = await getD1();
  if (!db) {
    return {
      totalFeedbacksIngested: 0,
      averageNormalizedRetention: 0,
      highPerformersIdentified: 0,
      lastUpdated: 0,
    };
  }

  try {
    const row = await db
      .prepare(
        `SELECT
          COUNT(*) as total,
          COALESCE(AVG(normalized_completion_score), 0) as avgScore,
          SUM(CASE WHEN normalized_completion_score >= 0.7 THEN 1 ELSE 0 END) as highPerformers,
          COALESCE(MAX(collected_at), 0) as lastUpdated
         FROM growth_post_publish_feedback
         WHERE user_id = ?`
      )
      .bind(userId)
      .first<{ total: number; avgScore: number; highPerformers: number; lastUpdated: number }>();

    return {
      totalFeedbacksIngested: row?.total ?? 0,
      averageNormalizedRetention: row?.avgScore ?? 0,
      highPerformersIdentified: row?.highPerformers ?? 0,
      lastUpdated: row?.lastUpdated ?? 0,
    };
  } catch (err) {
    logger.error('Failed to aggregate Bayesian feedback summary', { error: err });
    return {
      totalFeedbacksIngested: 0,
      averageNormalizedRetention: 0,
      highPerformersIdentified: 0,
      lastUpdated: 0,
    };
  }
}

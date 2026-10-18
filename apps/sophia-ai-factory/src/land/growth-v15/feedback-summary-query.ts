/**
 * Land Layer: Growth Triad v15 Feedback Summary Query
 * Aggregates post-publish feedback telemetry from D1.
 * @module land/growth-v15/feedback-summary-query
 */

import { getD1 } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { BayesianFeedbackSummary } from '@/seed/types/growth-triad-v15';

const EMPTY_FEEDBACK_SUMMARY: BayesianFeedbackSummary = {
  totalFeedbacksIngested: 0,
  averageNormalizedRetention: 0,
  highPerformersIdentified: 0,
  lastUpdated: 0,
};

export async function getFeedbackSummary(
  userId: string
): Promise<BayesianFeedbackSummary> {
  const db = await getD1();
  if (!db) {
    return { ...EMPTY_FEEDBACK_SUMMARY };
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
    return { ...EMPTY_FEEDBACK_SUMMARY };
  }
}

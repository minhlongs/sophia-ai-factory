/**
 * Creator Studio Statistics & Earnings Aggregations
 *
 * @module land/creator/studio/studio-stats
 */

import { logger } from '@/seed/utils/logger-utility';
import type { CreatorStudioStats } from '@/seed/types/creator-marketplace';

/**
 * Fetch aggregated statistics for a creator in Creator Studio.
 */
export async function getCreatorStudioStats(
  db: D1Database,
  creatorId: string,
): Promise<CreatorStudioStats> {
  let totalTemplates = 0;
  let totalUses = 0;
  let totalReviews = 0;
  let weightedRatingSum = 0;

  // 1. Template metrics
  try {
    const templateMetrics = await db
      .prepare(
        `SELECT
           COUNT(*) as total_templates,
           COALESCE(SUM(use_count), 0) as total_uses,
           COALESCE(SUM(review_count), 0) as total_reviews,
           COALESCE(SUM(rating * review_count), 0) as rating_sum
         FROM creator_templates
         WHERE creator_id = ? AND status != 'archived'`,
      )
      .bind(creatorId)
      .first<{
        total_templates?: number;
        total_uses?: number;
        total_reviews?: number;
        rating_sum?: number;
      }>();

    if (templateMetrics) {
      totalTemplates = templateMetrics.total_templates ?? 0;
      totalUses = templateMetrics.total_uses ?? 0;
      totalReviews = templateMetrics.total_reviews ?? 0;
      weightedRatingSum = templateMetrics.rating_sum ?? 0;
    }
  } catch (err) {
    logger.warn('Failed to query template metrics for studio stats', { creatorId, error: String(err) });
  }

  const averageRating = totalReviews > 0 ? Math.round((weightedRatingSum / totalReviews) * 10) / 10 : 0.0;

  // 2. Financial ledger & profile metrics
  let totalEarningsCents = 0;
  let totalPaidCents = 0;
  let pendingBalanceCents = 0;

  try {
    const profile = await db
      .prepare(
        `SELECT total_earnings_cents, total_paid_cents
         FROM creator_profiles
         WHERE id = ? OR user_id = ?
         LIMIT 1`,
      )
      .bind(creatorId, creatorId)
      .first<{ total_earnings_cents?: number; total_paid_cents?: number }>();

    if (profile) {
      totalEarningsCents = profile.total_earnings_cents ?? 0;
      totalPaidCents = profile.total_paid_cents ?? 0;
    }
  } catch (err) {
    logger.warn('Failed to query creator profile for earnings', { creatorId, error: String(err) });
  }

  try {
    const ledgerPending = await db
      .prepare(
        `SELECT COALESCE(SUM(amount_cents), 0) as pending_sum
         FROM creator_earnings_ledger
         WHERE creator_id = ? AND status = 'pending' AND event_type = 'royalty_accrual'`,
      )
      .bind(creatorId)
      .first<{ pending_sum?: number }>();

    if (ledgerPending) {
      pendingBalanceCents = ledgerPending.pending_sum ?? 0;
    }
  } catch {
    // Graceful fallback if ledger not queried
  }

  const creatorRoyaltyCents = totalEarningsCents;
  // Based on 70/30 protocol: gross = creatorRoyalty / 0.70
  const grossEarningsCents = creatorRoyaltyCents > 0
    ? Math.round(creatorRoyaltyCents / 0.7)
    : 0;
  const platformFeesCents = Math.max(0, grossEarningsCents - creatorRoyaltyCents);
  const availableBalanceCents = Math.max(0, totalEarningsCents - totalPaidCents);

  return {
    totalTemplates,
    totalUses,
    grossEarningsCents,
    creatorRoyaltyCents,
    platformFeesCents,
    availableBalanceCents,
    pendingBalanceCents,
    averageRating,
    totalReviews,
  };
}

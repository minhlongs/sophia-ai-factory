/**
 * Optimistic Concurrency Control (OCC) CAS: Viral CES Scorer.
 * Layer: tree (domain reusable)
 *
 * @module tree/learning-loop/cas/ces-scorer
 */

import type { VideoEngagementFeedback } from '@/seed/types/creative-intelligence';

export function safeNonNegative(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

/**
 * Calculates retention/completion score from engagement signals (0 to 1.0).
 */
export function calculateRetentionScore(feedback: VideoEngagementFeedback): number {
  if (typeof feedback.completionRate === 'number' && Number.isFinite(feedback.completionRate)) {
    return Math.max(0, Math.min(1, feedback.completionRate));
  }
  if (
    typeof feedback.metrics?.completionRate === 'number' &&
    Number.isFinite(feedback.metrics.completionRate)
  ) {
    return Math.max(0, Math.min(1, feedback.metrics.completionRate));
  }
  const watchTime = safeNonNegative(feedback.watchTimeSeconds ?? feedback.metrics?.watchTimeSeconds);
  const duration = safeNonNegative(feedback.totalDurationSeconds ?? feedback.durationSeconds);
  if (duration > 0 && watchTime > 0) {
    const rawRatio = watchTime / duration;
    return Number.isFinite(rawRatio) ? Math.max(0, Math.min(1, rawRatio)) : 0;
  }
  return 0;
}

/**
 * Calculates share rate score (0 to 1.0). 3% share rate = 1.0.
 */
export function calculateSharesScore(feedback: VideoEngagementFeedback, views: number): number {
  const shares = safeNonNegative(feedback.shares ?? feedback.metrics?.shares);
  const rawS = (shares / views) * 33.33;
  return Number.isFinite(rawS) ? Math.max(0, Math.min(1.0, rawS)) : 0;
}

/**
 * Calculates engagement depth score (likes + 2 * comments) / views (0 to 1.0).
 */
export function calculateEngagementDepthScore(
  feedback: VideoEngagementFeedback,
  views: number,
): number {
  const likes = safeNonNegative(feedback.likes);
  const comments = safeNonNegative(feedback.comments);
  const rawE = ((likes + 2 * comments) / views) * 10.0;
  return Number.isFinite(rawE) ? Math.max(0, Math.min(1.0, rawE)) : 0;
}

/**
 * Calculates commercial conversion score from CTR and conversion rate (0 to 1.0).
 */
export function calculateCommercialConversionScore(
  feedback: VideoEngagementFeedback,
  views: number,
): number {
  const rawImpressions = safeNonNegative(feedback.impressions);
  const impressions = Math.max(rawImpressions > 0 ? rawImpressions : views, 1);
  const clicks = safeNonNegative(feedback.clicks);
  const conversions = safeNonNegative(feedback.conversions);
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const convRate = clicks > 0 ? conversions / clicks : 0;
  const rawC = 0.6 * (ctr * 10.0) + 0.4 * (convRate * 5.0);
  return Number.isFinite(rawC) ? Math.max(0, Math.min(1.0, rawC)) : 0;
}

/**
 * Calculates normalized Creative Effectiveness Score (CES) from video engagement signals.
 *
 * Formula:
 *   CES = (0.35 * R + 0.30 * S + 0.20 * E + 0.15 * C) * 100
 *
 * Where:
 *   - R (Retention / Completion Rate): weight 35%
 *   - S (Viral Amplification / Share Rate): weight 30% (3% share rate = 1.0)
 *   - E (Engagement Depth / Likes + Comments): weight 20%
 *   - C (Commercial Conversion / CTR): weight 15%
 *
 * All inputs are strictly sanitized against NaN, Infinity, -Infinity, null, and undefined.
 */
export function calculateViralCES(feedback: VideoEngagementFeedback): number {
  const rawViews = safeNonNegative(feedback.views ?? feedback.metrics?.views);
  const views = Math.max(rawViews, 1);

  const R = calculateRetentionScore(feedback);
  const S = calculateSharesScore(feedback, views);
  const E = calculateEngagementDepthScore(feedback, views);
  const C = calculateCommercialConversionScore(feedback, views);

  const rawCes = (0.35 * R + 0.30 * S + 0.20 * E + 0.15 * C) * 100;
  if (!Number.isFinite(rawCes)) {
    return 0;
  }
  return Math.round(Math.min(100, Math.max(0, rawCes)) * 100) / 100;
}

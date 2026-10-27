/**
 * Auto Campaign Scaler & Video Frequency Manager
 *
 * Automatically monitors CTR, Conversion Rate (CVR), and Earnings Per Click (EPC)
 * to intelligently adjust publishing frequency or prune non-performing video hooks.
 *
 * Layer: tree/affiliate/scaling (Domain Logic)
 * @module tree/affiliate/scaling/auto-campaign-scaler
 */

export interface CampaignPerformanceMetrics {
  campaignId: string;
  hookName: string;
  niche: 'saas_global' | 'crypto_global' | 'ecommerce_tiktok';
  impressions: number;
  clicks: number;
  conversions: number;
  totalEarningsCents: number;
  publishedVideosCount: number;
  /** Observed media/traffic cost for the same cohort+window as earnings. */
  totalCostCents?: number;
  /** Age of the observation window in hours; immature samples are not winners. */
  observedWindowHours?: number;
  /** Explicit workspace permission to increase spend. */
  scalingPermissionGranted?: boolean;
}

export type ScalingAction = 'SCALE_AGGRESSIVE' | 'MAINTAIN_STEADY' | 'KILL_PRUNE';

export interface ScalingDecision {
  campaignId: string;
  hookName: string;
  niche?: 'saas_global' | 'crypto_global' | 'ecommerce_tiktok' | string;
  ctrPercent: number;
  cvrPercent: number;
  epcCents: number;
  recommendedDailyVideos: number;
  action: ScalingAction;
  reason: string;
  /** earnings - cost for the same cohort/window; null when cost is unknown. */
  contributionCents: number | null;
  costKnown: boolean;
}

export function evaluateCampaignScaling(
  metrics: CampaignPerformanceMetrics,
  minImpressionsThreshold = 100
): ScalingDecision {
  const { campaignId, hookName, niche, impressions, clicks, conversions, totalEarningsCents } = metrics;

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
  const epc = clicks > 0 ? totalEarningsCents / clicks : 0;
  const costKnown = typeof metrics.totalCostCents === 'number' && Number.isFinite(metrics.totalCostCents);
  const contributionCents = costKnown ? totalEarningsCents - (metrics.totalCostCents ?? 0) : null;
  // Maturity must be SUPPLIED, not assumed. An unknown observation window is
  // not evidence that a cohort is old enough to scale.
  const maturityOk =
    typeof metrics.observedWindowHours === 'number' &&
    Number.isFinite(metrics.observedWindowHours) &&
    metrics.observedWindowHours >= 24;

  // If under sample size threshold, maintain testing phase
  if (impressions < minImpressionsThreshold) {
    return {
      campaignId,
      hookName,
      niche,
      ctrPercent: Number(ctr.toFixed(2)),
      cvrPercent: Number(cvr.toFixed(2)),
      epcCents: Math.round(epc),
      recommendedDailyVideos: 1,
      action: 'MAINTAIN_STEADY',
      reason: 'Đang thu thập dữ liệu (Sample size < 100 impressions)',
      contributionCents,
      costKnown,
    };
  }

  // Aggressive scaling condition: high CTR (> 5%), solid CVR (> 2%), high EPC (> $0.50 / 50 cents)
  if (
    ctr >= 5.0 && cvr >= 2.0 && epc >= 50 &&
    costKnown && contributionCents !== null && contributionCents > 0 &&
    maturityOk && metrics.scalingPermissionGranted === true
  ) {
    return {
      campaignId,
      hookName,
      niche,
      ctrPercent: Number(ctr.toFixed(2)),
      cvrPercent: Number(cvr.toFixed(2)),
      epcCents: Math.round(epc),
      recommendedDailyVideos: 4, // Maximize viral frequency
      action: 'SCALE_AGGRESSIVE',
      reason: 'Dữ liệu đủ chín, đóng góp dương và có quyền tăng chi tiêu.',
      contributionCents,
      costKnown,
    };
  }

  // Prune condition: statistically significant impressions but near zero CTR (< 0.8%) or zero conversions after 50 clicks
  if (ctr < 0.8 || (clicks >= 50 && conversions === 0)) {
    return {
      campaignId,
      hookName,
      niche,
      ctrPercent: Number(ctr.toFixed(2)),
      cvrPercent: Number(cvr.toFixed(2)),
      epcCents: Math.round(epc),
      recommendedDailyVideos: 0,
      action: 'KILL_PRUNE',
      reason: 'Hiệu quả kém, không tạo ra chuyển đổi. Cắt giảm để tối ưu chi phí phân phối.',
      contributionCents,
      costKnown,
    };
  }

  return {
    campaignId,
    hookName,
    niche,
    ctrPercent: Number(ctr.toFixed(2)),
    cvrPercent: Number(cvr.toFixed(2)),
    epcCents: Math.round(epc),
    recommendedDailyVideos: 2,
    action: 'MAINTAIN_STEADY',
    reason: !costKnown
      ? 'Chưa có số liệu chi phí cùng cohort/window — không tự động tăng quy mô.'
      : contributionCents !== null && contributionCents <= 0
        ? 'Đóng góp không dương — không tự động tăng quy mô.'
        : 'Chưa đủ điều kiện chín/phép tăng chi tiêu — duy trì nhịp độ hiện tại.',
    contributionCents,
    costKnown,
  };
}

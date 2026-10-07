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
}

export type ScalingAction = 'SCALE_AGGRESSIVE' | 'MAINTAIN_STEADY' | 'KILL_PRUNE';

export interface ScalingDecision {
  campaignId: string;
  hookName: string;
  ctrPercent: number;
  cvrPercent: number;
  epcCents: number;
  recommendedDailyVideos: number;
  action: ScalingAction;
  reason: string;
}

export function evaluateCampaignScaling(
  metrics: CampaignPerformanceMetrics,
  minImpressionsThreshold = 100
): ScalingDecision {
  const { campaignId, hookName, impressions, clicks, conversions, totalEarningsCents } = metrics;

  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cvr = clicks > 0 ? (conversions / clicks) * 100 : 0;
  const epc = clicks > 0 ? totalEarningsCents / clicks : 0;

  // If under sample size threshold, maintain testing phase
  if (impressions < minImpressionsThreshold) {
    return {
      campaignId,
      hookName,
      ctrPercent: Number(ctr.toFixed(2)),
      cvrPercent: Number(cvr.toFixed(2)),
      epcCents: Math.round(epc),
      recommendedDailyVideos: 1,
      action: 'MAINTAIN_STEADY',
      reason: 'Đang thu thập dữ liệu (Sample size < 100 impressions)',
    };
  }

  // Aggressive scaling condition: high CTR (> 5%), solid CVR (> 2%), high EPC (> $0.50 / 50 cents)
  if (ctr >= 5.0 && cvr >= 2.0 && epc >= 50) {
    return {
      campaignId,
      hookName,
      ctrPercent: Number(ctr.toFixed(2)),
      cvrPercent: Number(cvr.toFixed(2)),
      epcCents: Math.round(epc),
      recommendedDailyVideos: 4, // Maximize viral frequency
      action: 'SCALE_AGGRESSIVE',
      reason: 'Hook viral đột phá (CTR >= 5%, CVR >= 2%, EPC cao), tăng tốc xuất xưởng video!',
    };
  }

  // Prune condition: statistically significant impressions but near zero CTR (< 0.8%) or zero conversions after 50 clicks
  if (ctr < 0.8 || (clicks >= 50 && conversions === 0)) {
    return {
      campaignId,
      hookName,
      ctrPercent: Number(ctr.toFixed(2)),
      cvrPercent: Number(cvr.toFixed(2)),
      epcCents: Math.round(epc),
      recommendedDailyVideos: 0,
      action: 'KILL_PRUNE',
      reason: 'Hiệu quả kém, không tạo ra chuyển đổi. Cắt giảm để tối ưu chi phí phân phối.',
    };
  }

  return {
    campaignId,
    hookName,
    ctrPercent: Number(ctr.toFixed(2)),
    cvrPercent: Number(cvr.toFixed(2)),
    epcCents: Math.round(epc),
    recommendedDailyVideos: 2,
    action: 'MAINTAIN_STEADY',
    reason: 'Hiệu suất ổn định, duy trì nhịp độ sản xuất thông thường.',
  };
}

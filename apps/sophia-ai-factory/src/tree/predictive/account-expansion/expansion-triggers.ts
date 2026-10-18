/**
 * Expansion Opportunity Trigger Evaluator
 *
 * Milestone: GATE 9: $2,500,000 MRR ($30M ARR, 10,000 Customers, $250 ARPU, Cohort NRR >= 135%)
 * Layer: tree/predictive (Pure domain heuristic rules)
 *
 * @module tree/predictive/account-expansion/expansion-triggers
 */

import {
  type CustomerPredictiveScore,
  type CustomerTelemetryFeatures,
  type ExpansionRecommendation,
} from '@/seed/types/predictive-expansion';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { RECOMMENDATION_EXPIRATION_DAYS } from './types';

type RecommendationSpecifics = Omit<
  ExpansionRecommendation,
  'id' | 'customerId' | 'orgId' | 'scoreId' | 'status' | 'appliedAt' | 'expiresAt' | 'createdAt' | 'updatedAt'
>;

function buildRecommendation(
  features: CustomerTelemetryFeatures,
  score: CustomerPredictiveScore,
  now: number,
  specifics: RecommendationSpecifics,
): ExpansionRecommendation {
  return {
    id: `rec_${features.customerId}_${now}`,
    customerId: features.customerId,
    orgId: features.orgId ?? null,
    scoreId: score.id,
    ...specifics,
    status: 'pending',
    appliedAt: null,
    expiresAt: now + RECOMMENDATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
    createdAt: now,
    updatedAt: now,
  };
}

export function evaluateExpansionOpportunity(
  features: CustomerTelemetryFeatures,
  score: CustomerPredictiveScore
): ExpansionRecommendation | null {
  const now = Date.now();
  const quotaSatPct = features.quotaMcuMonthly > 0
    ? Math.round((features.usedMcuMonthly / features.quotaMcuMonthly) * 100)
    : 0;

  // Rule 1: BASIC -> PREMIUM upgrade
  if (features.currentTier === 'BASIC' && (quotaSatPct >= 85 || score.expansionReadinessScore >= 0.70)) {
    return buildRecommendation(features, score, now, {
      recommendationType: 'tier_upgrade',
      currentTier: 'BASIC',
      targetTier: 'PREMIUM',
      currentMcuQuota: UNIFIED_TIERS.BASIC.mcuMonthly,
      recommendedMcuQuota: UNIFIED_TIERS.PREMIUM.mcuMonthly,
      currentGpuLanes: 0,
      recommendedGpuLanes: 0,
      currentMrrCents: UNIFIED_TIERS.BASIC.priceInCents,
      projectedExpansionMrrCents: UNIFIED_TIERS.PREMIUM.priceInCents - UNIFIED_TIERS.BASIC.priceInCents,
      priority: quotaSatPct >= 100 ? 'critical' : 'high',
      confidenceScore: 0.92,
      triggers: ['mcu_quota_saturation_high', 'video_production_velocity_surge'],
      rationaleEn: `Your monthly MCU quota utilization has reached ${quotaSatPct}%. Upgrading from Starter to Growth (PREMIUM) increases your capacity to 5,000 MCU/mo and unlocks multi-platform automated video syndication and API webhooks.`,
      rationaleVi: `Mức tiêu thụ hạn ngạch MCU hàng tháng của bạn đã đạt ${quotaSatPct}%. Nâng cấp từ gói Khởi đầu lên Tăng trưởng (PREMIUM) tăng dung lượng lên 5.000 MCU/tháng, đồng thời mở khóa phát hành tự động đa nền tảng và cổng API webhook.`,
      discountOfferPct: quotaSatPct >= 100 ? 10.0 : 0.0,
    });
  }

  // Rule 2: PREMIUM -> ENTERPRISE upgrade
  if (features.currentTier === 'PREMIUM' && (quotaSatPct >= 80 || score.expansionReadinessScore >= 0.75)) {
    return buildRecommendation(features, score, now, {
      recommendationType: 'tier_upgrade',
      currentTier: 'PREMIUM',
      targetTier: 'ENTERPRISE',
      currentMcuQuota: UNIFIED_TIERS.PREMIUM.mcuMonthly,
      recommendedMcuQuota: UNIFIED_TIERS.ENTERPRISE.mcuMonthly,
      currentGpuLanes: 0,
      recommendedGpuLanes: 0,
      currentMrrCents: UNIFIED_TIERS.PREMIUM.priceInCents,
      projectedExpansionMrrCents: UNIFIED_TIERS.ENTERPRISE.priceInCents - UNIFIED_TIERS.PREMIUM.priceInCents,
      priority: 'high',
      confidenceScore: 0.89,
      triggers: ['enterprise_scale_reached', 'mcu_utilization_above_80pct'],
      rationaleEn: `Your production demands have reached enterprise velocity (${features.usedMcuMonthly} MCU consumed). Upgrading to ENTERPRISE unlocks 20,000 MCU/mo, team collaboration seats, and direct executive strategy support.`,
      rationaleVi: `Nhu cầu sản xuất nội dung của bạn đã đạt quy mô doanh nghiệp (tiêu thụ ${features.usedMcuMonthly} MCU). Nâng cấp lên ENTERPRISE mở rộng 20.000 MCU/tháng, không gian làm việc nhóm và hỗ trợ chiến lược chuyên sâu.`,
      discountOfferPct: 0.0,
    });
  }

  // Rule 3: ENTERPRISE -> Dedicated GPU Lane Allocation (+$1,500/mo lease)
  if (features.currentTier === 'ENTERPRISE' && (features.videoGenerationsLast7d >= 60 || quotaSatPct >= 90)) {
    return buildRecommendation(features, score, now, {
      recommendationType: 'dedicated_gpu_lane',
      currentTier: 'ENTERPRISE',
      targetTier: 'ENTERPRISE',
      currentMcuQuota: UNIFIED_TIERS.ENTERPRISE.mcuMonthly,
      recommendedMcuQuota: UNIFIED_TIERS.ENTERPRISE.mcuMonthly + 50_000,
      currentGpuLanes: 0,
      recommendedGpuLanes: 1,
      currentMrrCents: UNIFIED_TIERS.ENTERPRISE.priceInCents,
      projectedExpansionMrrCents: 150_000,
      priority: 'high',
      confidenceScore: 0.95,
      triggers: ['high_throughput_video_production', 'gpu_concurrency_saturation'],
      rationaleEn: `High-frequency video generation detected (>60 videos/week). Reserving a Dedicated Edge GPU Lane guarantees 0ms queue wait time and priority rendering throughput.`,
      rationaleVi: `Phát hiện tần suất tạo video cường độ cao (>60 video/tuần). Đặt chỗ Làn GPU Độc quyền bảo đảm thời gian chờ hàng đợi 0ms và tốc độ render ưu tiên tối đa.`,
      discountOfferPct: 5.0,
    });
  }

  return null;
}

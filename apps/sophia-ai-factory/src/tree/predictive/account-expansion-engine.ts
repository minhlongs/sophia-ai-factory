/**
 * Enterprise Account Expansion Engine
 *
 * Milestone: GATE 9: $2,500,000 MRR ($30M ARR, 10,000 Customers, $250 ARPU, Cohort NRR >= 135%)
 * Layer: tree/predictive (Pure domain services & upgrade recommendation heuristics)
 * Imports only: @/seed
 *
 * @module tree/predictive/account-expansion-engine
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type CustomerPredictiveScore,
  type CustomerTelemetryFeatures,
  type ExpansionRecommendation,
  type ExpansionRecommendationRow,
  type ExpansionStage,
  type PredictiveAction,
  type RecommendationPriority,
  mapRowToExpansionRecommendation,
} from '@/seed/types/predictive-expansion';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';

export const RECOMMENDATION_EXPIRATION_DAYS = 30;

// ── Pure Expansion Scorer & Evaluator ───────────────────────────────────────

export function calculateExpansionReadiness(features: CustomerTelemetryFeatures): {
  expansionReadinessScore: number;
  expansionStage: ExpansionStage;
  recommendedAction: PredictiveAction;
} {
  const quotaSat = features.quotaMcuMonthly > 0
    ? features.usedMcuMonthly / features.quotaMcuMonthly
    : 0;

  const usageVelocity = features.videoGenerationsPrev30d > 0
    ? (features.videoGenerationsLast7d * 4 - features.videoGenerationsPrev30d) / features.videoGenerationsPrev30d
    : 0;

  const tenureScore = Math.min(1.0, Math.max(0.0, features.tenureDays / 90));
  const featureScore = Math.min(1.0, Math.max(0.0, features.featuresUsedCount / 8));
  const errorRate = features.apiRequestsCount > 0 ? features.apiErrorsCount / features.apiRequestsCount : 0;
  const healthScore = Math.max(0.0, Math.min(1.0, 1.0 - errorRate * 5));

  const rawScore =
    0.30 * Math.min(1.0, Math.max(0.0, quotaSat)) +
    0.25 * Math.min(1.0, Math.max(0.0, usageVelocity)) +
    0.15 * tenureScore +
    0.15 * featureScore +
    0.15 * healthScore;

  const expansionReadinessScore = Number(Math.min(1.0, Math.max(0.0, rawScore)).toFixed(4));

  let expansionStage: ExpansionStage = 'nurture';
  let recommendedAction: PredictiveAction = 'maintain';

  if (expansionReadinessScore >= 0.75) {
    expansionStage = 'ready';
    if (features.currentTier === 'ENTERPRISE') {
      recommendedAction = 'enterprise_gpu_lane';
    } else {
      recommendedAction = 'tier_upgrade';
    }
  } else if (expansionReadinessScore >= 0.55) {
    expansionStage = 'engaged';
    recommendedAction = quotaSat >= 0.80 ? 'quota_expansion' : 'maintain';
  }

  return { expansionReadinessScore, expansionStage, recommendedAction };
}

// ── Recommendation Rule Engine ─────────────────────────────────────────────

export function evaluateExpansionOpportunity(
  features: CustomerTelemetryFeatures,
  score: CustomerPredictiveScore
): ExpansionRecommendation | null {
  const now = Date.now();
  const expiresAt = now + RECOMMENDATION_EXPIRATION_DAYS * 24 * 60 * 60 * 1000;
  const quotaSatPct = features.quotaMcuMonthly > 0
    ? Math.round((features.usedMcuMonthly / features.quotaMcuMonthly) * 100)
    : 0;

  // Rule 1: BASIC -> PREMIUM upgrade
  if (features.currentTier === 'BASIC' && (quotaSatPct >= 85 || score.expansionReadinessScore >= 0.70)) {
    const currentPriceCents = UNIFIED_TIERS.BASIC.priceInCents;
    const targetPriceCents = UNIFIED_TIERS.PREMIUM.priceInCents;
    const expansionMrr = targetPriceCents - currentPriceCents; // +20,000 cents ($200)

    const priority: RecommendationPriority = quotaSatPct >= 100 ? 'critical' : 'high';

    return {
      id: `rec_${features.customerId}_${now}`,
      customerId: features.customerId,
      orgId: features.orgId ?? null,
      scoreId: score.id,
      recommendationType: 'tier_upgrade',
      currentTier: 'BASIC',
      targetTier: 'PREMIUM',
      currentMcuQuota: UNIFIED_TIERS.BASIC.mcuMonthly,
      recommendedMcuQuota: UNIFIED_TIERS.PREMIUM.mcuMonthly,
      currentGpuLanes: 0,
      recommendedGpuLanes: 0,
      currentMrrCents: currentPriceCents,
      projectedExpansionMrrCents: expansionMrr,
      priority,
      status: 'pending',
      confidenceScore: 0.92,
      triggers: ['mcu_quota_saturation_high', 'video_production_velocity_surge'],
      rationaleEn: `Your monthly MCU quota utilization has reached ${quotaSatPct}%. Upgrading from Starter to Growth (PREMIUM) increases your capacity to 5,000 MCU/mo and unlocks multi-platform automated video syndication and API webhooks.`,
      rationaleVi: `Mức tiêu thụ hạn ngạch MCU hàng tháng của bạn đã đạt ${quotaSatPct}%. Nâng cấp từ gói Khởi đầu lên Tăng trưởng (PREMIUM) tăng dung lượng lên 5.000 MCU/tháng, đồng thời mở khóa phát hành tự động đa nền tảng và cổng API webhook.`,
      discountOfferPct: quotaSatPct >= 100 ? 10.0 : 0.0,
      appliedAt: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Rule 2: PREMIUM -> ENTERPRISE upgrade
  if (features.currentTier === 'PREMIUM' && (quotaSatPct >= 80 || score.expansionReadinessScore >= 0.75)) {
    const currentPriceCents = UNIFIED_TIERS.PREMIUM.priceInCents;
    const targetPriceCents = UNIFIED_TIERS.ENTERPRISE.priceInCents;
    const expansionMrr = targetPriceCents - currentPriceCents; // +40,000 cents ($400)

    return {
      id: `rec_${features.customerId}_${now}`,
      customerId: features.customerId,
      orgId: features.orgId ?? null,
      scoreId: score.id,
      recommendationType: 'tier_upgrade',
      currentTier: 'PREMIUM',
      targetTier: 'ENTERPRISE',
      currentMcuQuota: UNIFIED_TIERS.PREMIUM.mcuMonthly,
      recommendedMcuQuota: UNIFIED_TIERS.ENTERPRISE.mcuMonthly,
      currentGpuLanes: 0,
      recommendedGpuLanes: 0,
      currentMrrCents: currentPriceCents,
      projectedExpansionMrrCents: expansionMrr,
      priority: 'high',
      status: 'pending',
      confidenceScore: 0.89,
      triggers: ['enterprise_scale_reached', 'mcu_utilization_above_80pct'],
      rationaleEn: `Your production demands have reached enterprise velocity (${features.usedMcuMonthly} MCU consumed). Upgrading to ENTERPRISE unlocks 20,000 MCU/mo, team collaboration seats, and direct executive strategy support.`,
      rationaleVi: `Nhu cầu sản xuất nội dung của bạn đã đạt quy mô doanh nghiệp (tiêu thụ ${features.usedMcuMonthly} MCU). Nâng cấp lên ENTERPRISE mở rộng 20.000 MCU/tháng, không gian làm việc nhóm và hỗ trợ chiến lược chuyên sâu.`,
      discountOfferPct: 0.0,
      appliedAt: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };
  }

  // Rule 3: ENTERPRISE -> Dedicated GPU Lane Allocation
  if (features.currentTier === 'ENTERPRISE' && (features.videoGenerationsLast7d >= 60 || quotaSatPct >= 90)) {
    const expansionMrr = 150_000; // +$1,500/mo GPU dedicated lease

    return {
      id: `rec_${features.customerId}_${now}`,
      customerId: features.customerId,
      orgId: features.orgId ?? null,
      scoreId: score.id,
      recommendationType: 'dedicated_gpu_lane',
      currentTier: 'ENTERPRISE',
      targetTier: 'ENTERPRISE',
      currentMcuQuota: UNIFIED_TIERS.ENTERPRISE.mcuMonthly,
      recommendedMcuQuota: UNIFIED_TIERS.ENTERPRISE.mcuMonthly + 50_000,
      currentGpuLanes: 0,
      recommendedGpuLanes: 1,
      currentMrrCents: UNIFIED_TIERS.ENTERPRISE.priceInCents,
      projectedExpansionMrrCents: expansionMrr,
      priority: 'high',
      status: 'pending',
      confidenceScore: 0.95,
      triggers: ['high_throughput_video_production', 'gpu_concurrency_saturation'],
      rationaleEn: `High-frequency video generation detected (>60 videos/week). Reserving a Dedicated Edge GPU Lane guarantees 0ms queue wait time and priority rendering throughput.`,
      rationaleVi: `Phát hiện tần suất tạo video cường độ cao (>60 video/tuần). Đặt chỗ Làn GPU Độc quyền bảo đảm thời gian chờ hàng đợi 0ms và tốc độ render ưu tiên tối đa.`,
      discountOfferPct: 5.0,
      appliedAt: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };
  }

  return null;
}

// ── D1 Persistence Operations ───────────────────────────────────────────────

export async function saveExpansionRecommendation(
  db: D1Database,
  rec: ExpansionRecommendation
): Promise<ExpansionRecommendation> {
  const stmt = db.prepare(`
    INSERT INTO expansion_recommendations (
      id, customer_id, org_id, score_id, recommendation_type,
      current_tier, target_tier, current_mcu_quota, recommended_mcu_quota,
      current_gpu_lanes, recommended_gpu_lanes, current_mrr_cents,
      projected_expansion_mrr_cents, priority, status, confidence_score,
      triggers_json, rationale_vi, rationale_en, discount_offer_pct,
      applied_at, expires_at, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      applied_at = excluded.applied_at,
      updated_at = excluded.updated_at
  `);

  await stmt
    .bind(
      rec.id,
      rec.customerId,
      rec.orgId,
      rec.scoreId,
      rec.recommendationType,
      rec.currentTier,
      rec.targetTier,
      rec.currentMcuQuota,
      rec.recommendedMcuQuota,
      rec.currentGpuLanes,
      rec.recommendedGpuLanes,
      rec.currentMrrCents,
      rec.projectedExpansionMrrCents,
      rec.priority,
      rec.status,
      rec.confidenceScore,
      JSON.stringify(rec.triggers),
      rec.rationaleVi,
      rec.rationaleEn,
      rec.discountOfferPct,
      rec.appliedAt,
      rec.expiresAt,
      rec.createdAt,
      rec.updatedAt
    )
    .run();

  return rec;
}

export async function getActiveRecommendationsForCustomer(
  db: D1Database,
  customerId: string
): Promise<ExpansionRecommendation[]> {
  const now = Date.now();
  const { results } = await db
    .prepare(`
      SELECT * FROM expansion_recommendations
      WHERE customer_id = ? AND status = 'pending' AND expires_at > ?
      ORDER BY projected_expansion_mrr_cents DESC
    `)
    .bind(customerId, now)
    .all<ExpansionRecommendationRow>();

  if (!results) return [];
  return results.map(mapRowToExpansionRecommendation);
}

export async function applyExpansionRecommendation(
  db: D1Database,
  recommendationId: string
): Promise<{ success: boolean; appliedAt: number }> {
  const now = Date.now();
  await db
    .prepare(`
      UPDATE expansion_recommendations
      SET status = 'accepted', applied_at = ?, updated_at = ?
      WHERE id = ? AND status = 'pending'
    `)
    .bind(now, now, recommendationId)
    .run();

  return { success: true, appliedAt: now };
}

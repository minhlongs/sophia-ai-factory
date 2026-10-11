/**
 * Account Expansion D1 Service
 *
 * Milestone: GATE 9: $2,500,000 MRR ($30M ARR, 10,000 Customers, $250 ARPU, Cohort NRR >= 135%)
 * Layer: tree/predictive (Persistence & state transitions)
 *
 * @module tree/predictive/account-expansion/account-expansion-service
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type ExpansionRecommendation,
  type ExpansionRecommendationRow,
  mapRowToExpansionRecommendation,
} from '@/seed/types/predictive-expansion';

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

/**
 * Partner Tier Evaluation and Promotion.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/tier-promotion
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { EvaluateTierResult, PartnerTier } from '@/tree/partners/types';
import { determinePartnerTier } from './commission-math';
import { getPartnerById } from './partner-profile';

/**
 * Evaluates and executes partner tier promotion if thresholds are reached.
 */
export async function evaluatePartnerTierPromotion(
  db: D1Database,
  partnerId: string,
  nowMs = Date.now(),
): Promise<EvaluateTierResult> {
  const partner = await getPartnerById(db, partnerId);
  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const evaluation = determinePartnerTier(
    partner.total_referred_customers,
    partner.total_mrr_cents,
  );

  const tierRank: Record<PartnerTier, number> = { SILVER: 1, GOLD: 2, PLATINUM: 3 };
  const promoted = tierRank[evaluation.tier] > tierRank[partner.tier];

  if (promoted || evaluation.tier !== partner.tier) {
    await db
      .prepare(
        `UPDATE partner_profiles
         SET tier = ?1,
             commission_rate_pct = ?2,
             whitelabel_enabled = ?3,
             updated_at = ?4
         WHERE id = ?5`
      )
      .bind(
        evaluation.tier,
        evaluation.commissionRatePct,
        evaluation.whitelabelEnabled ? 1 : partner.whitelabel_enabled,
        nowMs,
        partnerId,
      )
      .run();
  }

  return {
    partnerId,
    currentTier: partner.tier,
    newTier: evaluation.tier,
    promoted,
    commissionRatePct: evaluation.commissionRatePct,
    whitelabelEnabled: evaluation.whitelabelEnabled,
  };
}

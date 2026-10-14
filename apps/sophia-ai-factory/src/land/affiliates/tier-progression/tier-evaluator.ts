import { logger } from '@/seed/utils/logger-utility';
import type {
  AffiliateTier,
  TierUpgradeEvaluationResult,
} from '@/seed/types/affiliate-expansion-types';
import { getTierForMrr } from './tier-config-calculator';
import { calculateMrrForAffiliate } from './mrr-aggregator';

/**
 * Evaluates an affiliate partner's MRR and automatically upgrades their tier if threshold met.
 * Persists the upgraded tier, commission rate, and activated MRR into D1.
 */
export async function evaluateAndUpgradeTier(
  d1: D1Database,
  affiliateIdOrCode: string,
  explicitMrrCents?: number
): Promise<TierUpgradeEvaluationResult> {
  const partnerStmt = d1.prepare(`
    SELECT id, partner_code, tier, commission_rate_pct, tier2_rate_pct, activated_mrr_cents
    FROM affiliate_partners
    WHERE id = ? OR partner_code = ?
    LIMIT 1
  `);
  const partner = await partnerStmt.bind(affiliateIdOrCode, affiliateIdOrCode).first<{
    id: string;
    partner_code: string;
    tier: string;
    commission_rate_pct: number;
    tier2_rate_pct: number;
    activated_mrr_cents: number | null;
  }>();

  if (!partner) {
    throw new Error(`Affiliate partner not found: ${affiliateIdOrCode}`);
  }

  const effectiveMrrCents =
    explicitMrrCents !== undefined
      ? Math.max(0, Math.floor(explicitMrrCents))
      : await calculateMrrForAffiliate(d1, partner.id);

  const targetConfig = getTierForMrr(effectiveMrrCents);
  const previousTier = (partner.tier as AffiliateTier) || 'SILVER';
  const isHigherTier =
    (previousTier === 'SILVER' && (targetConfig.tier === 'GOLD' || targetConfig.tier === 'PLATINUM')) ||
    (previousTier === 'GOLD' && targetConfig.tier === 'PLATINUM');

  const nowMs = Date.now();

  if (isHigherTier || previousTier !== targetConfig.tier || partner.activated_mrr_cents !== effectiveMrrCents) {
    const updateStmt = d1.prepare(`
      UPDATE affiliate_partners
      SET tier = ?,
          commission_rate_pct = ?,
          tier2_rate_pct = ?,
          activated_mrr_cents = ?,
          updated_at = ?
      WHERE id = ?
    `);
    await updateStmt
      .bind(
        targetConfig.tier,
        targetConfig.commissionRatePct,
        targetConfig.tier2RatePct,
        effectiveMrrCents,
        nowMs,
        partner.id
      )
      .run();

    if (isHigherTier) {
      logger.info('[tier-progression-engine] Upgraded partner tier', {
        partnerId: partner.id,
        partnerCode: partner.partner_code,
        previousTier,
        newTier: targetConfig.tier,
        mrrUsd: (effectiveMrrCents / 100).toFixed(2),
      });
    }
  }

  return {
    affiliateId: partner.id,
    partnerCode: partner.partner_code,
    previousTier,
    newTier: targetConfig.tier,
    upgraded: isHigherTier,
    activatedMrrCents: effectiveMrrCents,
    activatedMrrUsd: effectiveMrrCents / 100,
    commissionRatePct: targetConfig.commissionRatePct,
    tier2RatePct: targetConfig.tier2RatePct,
    evaluatedAt: new Date(nowMs).toISOString(),
  };
}

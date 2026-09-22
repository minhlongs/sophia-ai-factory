/**
 * Affiliate Tier Progression Engine
 *
 * Automates 2-Tier Master Affiliate progression based on activated monthly recurring revenue (MRR):
 * - Silver (20% direct, 5% Tier 2): $0 - $999.99 MRR
 * - Gold (25% direct, 5% Tier 2): $1,000 - $4,999.99 MRR
 * - Platinum (30% direct, 5% Tier 2): $5,000+ MRR
 *
 * @module land/affiliates/tier-progression-engine
 */

import { logger } from '@/seed/utils/logger-utility';
import {
  AffiliateTier,
  AffiliateTierConfig,
  AFFILIATE_TIER_CONFIGS,
  TierUpgradeEvaluationResult,
} from '@/seed/types/affiliate-expansion-types';

/**
 * Determine the canonical affiliate tier config for a given MRR in cents.
 */
export function getTierForMrr(mrrCents: number): AffiliateTierConfig {
  const safeCents = Math.max(0, Math.floor(mrrCents));

  if (safeCents >= AFFILIATE_TIER_CONFIGS.PLATINUM.minMrrCents) {
    return AFFILIATE_TIER_CONFIGS.PLATINUM;
  }
  if (safeCents >= AFFILIATE_TIER_CONFIGS.GOLD.minMrrCents) {
    return AFFILIATE_TIER_CONFIGS.GOLD;
  }
  return AFFILIATE_TIER_CONFIGS.SILVER;
}

/**
 * Calculate dual-tier recurring commission based on tier configuration and order amount.
 */
export function calculateDualTierCommission(
  tier: AffiliateTier,
  orderAmountCents: number,
  isTier2 = false
): {
  ratePct: number;
  commissionCents: number;
  tier: AffiliateTier | 'TIER2';
  isTier2: boolean;
} {
  if (orderAmountCents <= 0) {
    return {
      ratePct: 0,
      commissionCents: 0,
      tier: isTier2 ? 'TIER2' : tier,
      isTier2,
    };
  }

  const config = AFFILIATE_TIER_CONFIGS[tier] || AFFILIATE_TIER_CONFIGS.SILVER;

  if (isTier2) {
    const ratePct = config.tier2RatePct;
    const commissionCents = Math.round(orderAmountCents * (ratePct / 100));
    return {
      ratePct,
      commissionCents,
      tier: 'TIER2',
      isTier2: true,
    };
  }

  const ratePct = config.commissionRatePct;
  const commissionCents = Math.round(orderAmountCents * (ratePct / 100));

  return {
    ratePct,
    commissionCents,
    tier: config.tier,
    isTier2: false,
  };
}

/**
 * Calculate an affiliate partner's activated monthly recurring revenue (MRR) in cents.
 * Aggregates verified active customer subscriptions and 30-day conversion volume from D1.
 */
export async function calculateMrrForAffiliate(
  d1: D1Database,
  affiliateIdOrCode: string
): Promise<number> {
  try {
    // 1. Check partner record
    const partnerStmt = d1.prepare(`
      SELECT id, partner_code, activated_mrr_cents
      FROM affiliate_partners
      WHERE id = ? OR partner_code = ?
      LIMIT 1
    `);
    const partner = await partnerStmt.bind(affiliateIdOrCode, affiliateIdOrCode).first<{
      id: string;
      partner_code: string;
      activated_mrr_cents: number | null;
    }>();

    if (!partner) {
      return 0;
    }

    const partnerId = partner.id;

    // 2. Query verified active subscriptions or recurring 30-day revenue from commission ledger
    const thirtyDaysAgoMs = Date.now() - 30 * 86400 * 1000;
    const ledgerStmt = d1.prepare(`
      SELECT COALESCE(SUM(gross_cents), 0) as recent_mrr
      FROM commission_ledger
      WHERE affiliate_id = ?
        AND status IN ('payable', 'paid', 'pending')
        AND created_at >= ?
    `);
    const ledgerRow = await ledgerStmt.bind(partnerId, thirtyDaysAgoMs).first<{ recent_mrr: number }>();
    const ledgerMrr = ledgerRow?.recent_mrr ? Number(ledgerRow.recent_mrr) : 0;

    // 3. Query explicitly recorded activated MRR
    const storedMrr = partner.activated_mrr_cents ? Number(partner.activated_mrr_cents) : 0;

    // Return the maximum verified active MRR representation
    return Math.max(ledgerMrr, storedMrr);
  } catch (error) {
    logger.warn('[tier-progression-engine] Failed to calculate MRR from D1, falling back to 0', {
      affiliateIdOrCode,
      error: String(error),
    });
    return 0;
  }
}

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

/**
 * Batch evaluates all active affiliate partners in D1 and applies upgrades.
 */
export async function batchEvaluateAllPartners(
  d1: D1Database
): Promise<TierUpgradeEvaluationResult[]> {
  const partnersStmt = d1.prepare(`
    SELECT id, partner_code
    FROM affiliate_partners
    WHERE status = 'active'
    ORDER BY created_at ASC
  `);
  const { results } = await partnersStmt.all<{ id: string; partner_code: string }>();

  const partners = results ?? [];
  const resultsList: TierUpgradeEvaluationResult[] = [];

  for (const p of partners) {
    try {
      const evaluation = await evaluateAndUpgradeTier(d1, p.id);
      resultsList.push(evaluation);
    } catch (err) {
      logger.error('[tier-progression-engine] Failed evaluating partner in batch', {
        partnerId: p.id,
        error: String(err),
      });
    }
  }

  return resultsList;
}

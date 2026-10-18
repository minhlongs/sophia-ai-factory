/**
 * Affiliate Scout Offer Processor
 *
 * @module land/affiliates/scout/writer/offer-processor
 */

import type { ScoutEnv, Affiliate } from '../types';
import { scoreAffiliate } from '../scoring';
import type { ScoringContext } from '../scoring';
import { isCategoryAllowedForTenant } from '@/seed/security/geo-gate';
import { emit } from '@/land/webhooks';
import { logger } from '@/seed/utils/logger-utility';
import { upsertAffiliate } from './upsert';

/**
 * Checks whether the environment has any real affiliate network credentials.
 */
export function hasRealAffiliateCredentials(env: ScoutEnv): boolean {
  return Boolean(
    env.IMPACT_RADIUS_API_KEY ||
      env.PARTNERSTACK_API_KEY ||
      env.CJ_AFFILIATE_API_KEY ||
      env.SHAREASALE_TOKEN ||
      env.AWIN_API_TOKEN ||
      env.RAKUTEN_TOKEN ||
      env.BINANCE_API_KEY ||
      env.BYBIT_API_KEY ||
      env.BITGET_API_KEY ||
      env.COINBASE_API_KEY,
  );
}

/**
 * Process a single affiliate offer: score, persist, and emit webhook if eligible.
 */
export async function processOffer(
  env: ScoutEnv,
  db: D1Database,
  tenantId: string,
  raw: Omit<Affiliate, 'id' | 'tenantId' | 'discoveredAt'>,
  discoveredAt: string,
  scoringCtx: ScoringContext,
  tenantCountry?: string,
): Promise<boolean> {
  const affiliate: Affiliate = {
    id: crypto.randomUUID(),
    tenantId,
    discoveredAt,
    ...raw,
  };

  const scored = scoreAffiliate(affiliate, scoringCtx);
  if (!scored.passes) {
    logger.info(
      `[affiliate-scout] Skipping low-quality offer ${affiliate.externalId} (score ${scored.score})`,
    );
    return false;
  }

  const inserted = await upsertAffiliate(db, affiliate, scored.score, scored.breakdown);
  if (!inserted) {
    return false;
  }

  const category = affiliate.category ?? '';
  if (tenantCountry && category) {
    const allowed = await isCategoryAllowedForTenant(db, tenantId, tenantCountry, category);
    if (!allowed) {
      logger.info(
        `[affiliate-scout] Geo-blocked emit for ${affiliate.externalId} (country=${tenantCountry}, category=${category})`,
      );
      return true;
    }
  }

  emit(
    env,
    'affiliate.discovered',
    {
      affiliateId: affiliate.id,
      tenantId,
      network: affiliate.network,
      externalId: affiliate.externalId,
      productName: affiliate.productName,
      commissionPct: affiliate.commissionPct ?? null,
      commissionFlatUsd: affiliate.commissionFlatUsd ?? null,
      score: scored.score,
    },
    tenantId,
  );

  return true;
}

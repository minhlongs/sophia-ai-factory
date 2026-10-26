/**
 * @module land/affiliates/market-pulse/cex-fee-rebate-matrix
 * Computes fee savings, user kickback, and net affiliate yield across Binance, Bybit, OKX, and Bitget.
 */

import {
  CEX_AFFILIATE_REGISTRY,
  type CexExchangeId,
  type CexAffiliateProgramSpec,
} from '@/seed/config/cex-affiliate-registry';

export interface CexRebateComparisonRow {
  exchange: CexExchangeId;
  displayName: string;
  effectiveMakerFeePct: number;
  effectiveTakerFeePct: number;
  userKickbackPct: number;
  affiliateNetRebatePct: number;
  welcomeBonusUsd: number;
  annualTraderSavingsUsdAt100kVol: number;
}

export function buildCexRebateComparisonMatrix(
  customKickbackPct?: Partial<Record<CexExchangeId, number>>,
): CexRebateComparisonRow[] {
  const exchanges = Object.values(CEX_AFFILIATE_REGISTRY) as CexAffiliateProgramSpec[];

  return exchanges
    .map((spec) => {
      const kickback = customKickbackPct?.[spec.exchange] ?? spec.defaultUserKickbackPct;
      const discountFactor = Math.max(0, 1 - kickback / 100);
      const effMaker = Math.round(spec.makerFeePct * discountFactor * 10000) / 10000;
      const effTaker = Math.round(spec.takerFeePct * discountFactor * 10000) / 10000;
      const netAffiliate = Math.max(0, spec.maxAffiliateRebatePct - kickback);
      const monthlyFeeSaved = 100_000 * ((spec.takerFeePct - effTaker) / 100);

      return {
        exchange: spec.exchange,
        displayName: spec.displayName,
        effectiveMakerFeePct: effMaker,
        effectiveTakerFeePct: effTaker,
        userKickbackPct: kickback,
        affiliateNetRebatePct: netAffiliate,
        welcomeBonusUsd: spec.maxWelcomeBonusUsd,
        annualTraderSavingsUsdAt100kVol: Math.round(monthlyFeeSaved * 12),
      };
    })
    .sort((a, b) => b.welcomeBonusUsd - a.welcomeBonusUsd);
}

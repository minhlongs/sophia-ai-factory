/**
 * Creator Settlement Currency & FX Resolution Engine.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/settlement-currency
 */

import type {
  SettlementCurrency,
  SettlementPayoutRail,
} from '@/seed/types/creator-dao-c2pa';
import type { SettlementCurrencyDetails } from './types';

/**
 * Resolves target currency, FX conversion rate, and calculated settlement amount based on rail.
 */
export function resolveSettlementCurrencyAndAmount(
  payoutRail: SettlementPayoutRail,
  netPayableCents: number,
  customFxRate?: number,
): SettlementCurrencyDetails {
  let settlementCurrency: SettlementCurrency = 'USDC';
  let fxRateApplied = customFxRate ?? 1.0;

  if (payoutRail === 'PAYOS_VIETQR') {
    settlementCurrency = 'VND';
    if (fxRateApplied === 1.0) fxRateApplied = 25400.0;
  } else if (payoutRail === 'PROMPTPAY') {
    settlementCurrency = 'THB';
    if (fxRateApplied === 1.0) fxRateApplied = 36.5;
  } else if (payoutRail === 'SEPA_INSTANT') {
    settlementCurrency = 'EUR';
    if (fxRateApplied === 1.0) fxRateApplied = 0.92;
  }

  const netDollars = netPayableCents / 100.0;
  const settlementAmount = Math.round(netDollars * fxRateApplied * 100) / 100;

  return { settlementCurrency, fxRateApplied, settlementAmount };
}

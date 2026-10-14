/**
 * Localized Payment Rail Dispatcher Constants & Price Resolution
 *
 * Layer: tree/rails/dispatcher
 */

export const TIER_MONTHLY_PRICES_USD_CENTS: Readonly<Record<string, number>> = {
  FREE: 0,
  STARTER: 4900,
  BASIC: 9900,
  CREATOR: 14900,
  GROWTH: 29900,
  PREMIUM: 29900,
  SCALE: 59900,
  ENTERPRISE: 79900,
  MASTER: 199900,
};

export const DEFAULT_PROMPTPAY_RECIPIENT = '0812345678'; // Merchant Thai PromptPay Mobile
export const DEFAULT_PAYNOW_UEN = '202412345A';          // Merchant Singapore UEN
export const DEFAULT_SEPA_CREDITOR_ID = 'DE98ZZZ09999999999';
export const DEFAULT_SEPA_CREDITOR_NAME = 'Sophia AI Factory GmbH';

/**
 * Resolves base price in USD cents for a given tier and billing cycle.
 * Annual billing applies 2 months free discount (10 months price).
 */
export function resolveTierPriceCents(
  tier: string,
  billingCycle: 'monthly' | 'annual' | 'one_time',
): number {
  const normalizedTier = tier.toUpperCase();
  const monthlyPrice = TIER_MONTHLY_PRICES_USD_CENTS[normalizedTier] ?? 9900;

  if (billingCycle === 'annual') {
    return monthlyPrice * 10; // 2 months free on annual commitment
  }

  return monthlyPrice;
}

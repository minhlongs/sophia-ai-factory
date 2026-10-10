/**
 * Currency pricing configs, tier mapping, and fallback invoice URL builders.
 *
 * @module tree/clients/nowpayments/currency-service
 */

import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import { getOneTimeSkuById, getOneTimeSkuByInvoiceId, ONE_TIME_INVOICE_IDS } from '@/seed/config/one-time-skus';
import type { OneTimeSku } from '@/seed/types';
import type { NowPaymentsTierConfig, InvoiceLookup } from './types';

export const TIER_PRICE_CONFIG: Record<
  string,
  { price: number; yearlyPrice: number; currency: string; name: string }
> = {
  BASIC: {
    price: UNIFIED_TIERS.BASIC.price,
    yearlyPrice: UNIFIED_TIERS.BASIC.yearlyPrice,
    currency: 'USD',
    name: UNIFIED_TIERS.BASIC.name,
  },
  PREMIUM: {
    price: UNIFIED_TIERS.PREMIUM.price,
    yearlyPrice: UNIFIED_TIERS.PREMIUM.yearlyPrice,
    currency: 'USD',
    name: UNIFIED_TIERS.PREMIUM.name,
  },
  ENTERPRISE: {
    price: UNIFIED_TIERS.ENTERPRISE.price,
    yearlyPrice: UNIFIED_TIERS.ENTERPRISE.yearlyPrice,
    currency: 'USD',
    name: UNIFIED_TIERS.ENTERPRISE.name,
  },
  MASTER: {
    price: UNIFIED_TIERS.MASTER.price,
    yearlyPrice: UNIFIED_TIERS.MASTER.yearlyPrice,
    currency: 'USD',
    name: UNIFIED_TIERS.MASTER.name,
  },
};

/**
 * @deprecated Use createCheckout() instead. Pre-created invoice IDs retained
 * as emergency fallback. Will be removed in next release cycle.
 */
export const NOWPAYMENTS_TIERS: Record<string, NowPaymentsTierConfig> = {
  BASIC: {
    tier: 'BASIC',
    invoiceId: '5710519960',
    yearlyInvoiceId: '5710519960',
    price: 199,
    yearlyPrice: 1990,
    currency: 'USD',
    name: 'Starter',
  },
  PREMIUM: {
    tier: 'PREMIUM',
    invoiceId: '4559269964',
    yearlyInvoiceId: '4559269964',
    price: 399,
    yearlyPrice: 3990,
    currency: 'USD',
    name: 'Growth',
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    invoiceId: '6336799275',
    yearlyInvoiceId: '6336799275',
    price: 799,
    yearlyPrice: 7990,
    currency: 'USD',
    name: 'Premium',
  },
  MASTER: {
    tier: 'MASTER',
    invoiceId: '5589879034',
    yearlyInvoiceId: '5589879034',
    price: 4999,
    yearlyPrice: 0,
    currency: 'USD',
    name: 'Master',
  },
};

export const NOWPAYMENTS_CHECKOUT_BASE =
  process.env.NOWPAYMENTS_CHECKOUT_BASE || 'https://nowpayments.io/payment';

/**
 * @deprecated Use createCheckout() instead. Builds URL from pre-created invoice IDs.
 */
export function createInvoiceUrl(
  tierId: string,
  userId: string,
  customerEmail?: string,
  period?: 'monthly' | 'yearly',
  orderId?: string,
): string {
  const tierConfig = NOWPAYMENTS_TIERS[tierId];
  if (!tierConfig) throw new Error(`Unknown tier: ${tierId}`);

  const isYearly = period === 'yearly';
  const invoiceId = isYearly && tierConfig.yearlyInvoiceId ? tierConfig.yearlyInvoiceId : tierConfig.invoiceId;
  if (isYearly && tierConfig.yearlyPrice === 0) {
    throw new Error(`Yearly billing not available for tier: ${tierId}`);
  }

  const resolvedOrderId = orderId || `sophia_${userId}_${Date.now()}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

  const successParams = new URLSearchParams({ tier: tierId, order_id: resolvedOrderId });
  if (customerEmail) successParams.set('email', encodeURIComponent(customerEmail));

  const params = new URLSearchParams({
    iid: invoiceId,
    order_id: resolvedOrderId,
    success_url: `${appUrl}/payment-success?${successParams.toString()}`,
    cancel_url: `${appUrl}/pricing`,
  });

  return `${NOWPAYMENTS_CHECKOUT_BASE}?${params.toString()}`;
}

/**
 * @deprecated Use createOneTimeCheckout() instead.
 */
export function createOneTimeInvoiceUrl(
  sku: OneTimeSku,
  userId: string,
  customerEmail?: string,
  orderId?: string,
): string {
  const resolvedOrderId = orderId || `sophia_${userId}_${Date.now()}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

  const successParams = new URLSearchParams({ sku: sku.id, order_id: resolvedOrderId });
  if (customerEmail) successParams.set('email', encodeURIComponent(customerEmail));

  const params = new URLSearchParams({
    iid: sku.invoiceId,
    order_id: resolvedOrderId,
    success_url: `${appUrl}/payment-success?${successParams.toString()}`,
    cancel_url: `${appUrl}/pricing`,
  });

  return `${NOWPAYMENTS_CHECKOUT_BASE}?${params.toString()}`;
}

/**
 * @deprecated Use createCheckout() instead. Looks up tier by pre-created invoice ID.
 */
export function getTierByInvoiceId(invoiceId: string): NowPaymentsTierConfig | null {
  return (
    Object.values(NOWPAYMENTS_TIERS).find(
      (t) => t.invoiceId === invoiceId || t.yearlyInvoiceId === invoiceId,
    ) ?? null
  );
}

/**
 * Lookup an invoice ID and return a discriminated union.
 */
export function lookupInvoice(invoiceId: string): InvoiceLookup {
  if (ONE_TIME_INVOICE_IDS.has(invoiceId)) {
    const sku = getOneTimeSkuByInvoiceId(invoiceId);
    if (sku) return { kind: 'one_time', sku };
  }

  const config = getTierByInvoiceId(invoiceId);
  if (config) return { kind: 'subscription', tier: config.tier, config };

  return null;
}

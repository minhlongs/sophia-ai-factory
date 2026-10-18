/**
 * Currency pricing configs, tier mapping, and fallback invoice URL builders.
 *
 * @module tree/clients/nowpayments/currency-service
 */

import { getOneTimeSkuByInvoiceId, ONE_TIME_INVOICE_IDS } from '@/seed/config/one-time-skus';
import type { OneTimeSku } from '@/seed/types';
import type { NowPaymentsTierConfig, InvoiceLookup } from './types';
import {
  TIER_PRICE_CONFIG,
  NOWPAYMENTS_TIERS,
  NOWPAYMENTS_CHECKOUT_BASE,
} from './currency-tier-configs';

export { TIER_PRICE_CONFIG, NOWPAYMENTS_TIERS, NOWPAYMENTS_CHECKOUT_BASE };

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

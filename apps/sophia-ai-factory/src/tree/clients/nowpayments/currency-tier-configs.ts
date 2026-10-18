/**
 * NOWPayments tier price configurations and checkout base URL.
 *
 * @module tree/clients/nowpayments/currency-tier-configs
 */

import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import type { NowPaymentsTierConfig } from './types';

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

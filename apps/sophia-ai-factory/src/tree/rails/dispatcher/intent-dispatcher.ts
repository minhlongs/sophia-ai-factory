/**
 * Localized Payment Intent Dispatcher
 *
 * Layer: tree/rails/dispatcher
 */

import type {
  LocalizedPaymentIntentInput,
  LocalizedPaymentIntentResult,
} from '@/seed/types/localized-rails';
import type { SupportedCurrency } from '@/seed/types/enterprise-billing';
import { calculateHedgedQuote, normalizeCurrencyAmount } from '@/tree/fx/fx-hedging-engine';
import { calculateTaxObligation } from '@/tree/tax/tax-compliance-engine';
import { resolveTierPriceCents } from './constants';
import { buildRailPayload } from './rail-payload-builder';

export type DispatchedPaymentIntent = LocalizedPaymentIntentResult & {
  marketRate: number;
  hedgedRate: number;
  bufferReserveCents: number;
  taxJurisdiction: string;
  taxRate: number;
  taxAmountCents: number;
  isReverseCharge: boolean;
  taxNote: string;
  subtotalAmount: number;
  totalAmount: number;
};

/**
 * Dispatches a localized payment intent.
 * Handles FX hedging calculation, tax compliance, and rail-specific payload generation.
 */
export async function dispatchLocalizedPaymentIntent(
  input: LocalizedPaymentIntentInput,
  customRates?: Record<SupportedCurrency, number>,
): Promise<DispatchedPaymentIntent> {
  const {
    tier,
    billingCycle,
    rail,
    currency,
    billingCountry,
    taxId,
    customerType,
  } = input;

  // 1. Resolve base amount in USD cents
  const baseAmountCents = resolveTierPriceCents(tier, billingCycle);

  // 2. Calculate Hedged FX Quote with +1.5% buffer reserve
  const hedgedQuote = calculateHedgedQuote(
    { baseAmountCents, targetCurrency: currency },
    customRates,
  );

  // 3. Calculate Tax Obligation (EU VAT MOSS, SG GST, VN TT78)
  const taxResult = calculateTaxObligation({
    subtotalCents: baseAmountCents,
    countryCode: billingCountry,
    taxId,
    customerType,
    serviceType: 'software_saas',
  });

  // Calculate tax amount in target currency
  const subtotalTargetAmount = hedgedQuote.targetAmount;
  let taxTargetAmount = 0;
  if (taxResult.applicableRate > 0) {
    const rawTax = subtotalTargetAmount * taxResult.applicableRate;
    taxTargetAmount = normalizeCurrencyAmount(rawTax, currency).major;
  }

  const rawTotalAmount = subtotalTargetAmount + taxTargetAmount;
  const { major: totalAmount, subunits: totalAmountSubunits } = normalizeCurrencyAmount(
    rawTotalAmount,
    currency,
  );

  const transactionId = `txn_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const expiresAt = Date.now() + 15 * 60 * 1000;

  // 4. Dispatch to localized rail
  const railPayload = buildRailPayload({ input, transactionId, totalAmount });

  return {
    transactionId,
    status: 'pending',
    rail,
    currency,
    baseAmountCents,
    subtotalAmount: subtotalTargetAmount,
    taxAmount: taxTargetAmount,
    totalAmount,
    totalAmountSubunits,
    qrPayload: railPayload.qrPayload,
    qrImageUrl: railPayload.qrImageUrl,
    mandateReference: railPayload.mandateReference,
    checkoutUrl: railPayload.checkoutUrl,
    expiresAt,
    marketRate: hedgedQuote.marketRate,
    hedgedRate: hedgedQuote.hedgedRate,
    bufferReserveCents: hedgedQuote.bufferReserveCents,
    taxJurisdiction: taxResult.jurisdiction,
    taxRate: taxResult.applicableRate,
    taxAmountCents: taxResult.taxAmountCents,
    isReverseCharge: taxResult.isReverseCharge,
    taxNote: taxResult.complianceNote,
  };
}

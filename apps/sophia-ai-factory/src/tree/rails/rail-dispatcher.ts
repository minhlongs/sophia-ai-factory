/**
 * Unified Localized Payment Rail Dispatcher
 *
 * Orchestrates localized payment rails across 10 currencies:
 * - SEPA Direct Debit (EU)
 * - PromptPay Thai QR (TH)
 * - PayNow SGQR & GrabPay (SG/SEA)
 * - PayOS VietQR (VN)
 * - NOWPayments Crypto (Global)
 *
 * Integrates:
 * 1. Multi-tier dynamic FX hedging (+1.5% buffer reserve)
 * 2. Automated multi-jurisdiction tax engine (EU VAT MOSS, SG GST, VN TT78)
 * 3. Zero-decimal integer handling (JPY, VND, IDR)
 * 4. Safe fallback and idempotency management
 *
 * Layer: tree/rails (Pure domain service — imports only from seed and tree)
 *
 * @module tree/rails/rail-dispatcher
 */

import {
  type LocalizedPaymentIntentInput,
  type LocalizedPaymentIntentResult,
  type LocalizedPaymentRail,
} from '@/seed/types/localized-rails';
import { type SupportedCurrency } from '@/seed/types/enterprise-billing';
import { calculateHedgedQuote, normalizeCurrencyAmount } from '@/tree/fx/fx-hedging-engine';
import { calculateTaxObligation } from '@/tree/tax/tax-compliance-engine';
import { generateSepaMandate, validateIban } from './sepa-direct-debit';
import { generatePromptPayQrPayload } from './promptpay-thai-qr';
import { generatePayNowQrPayload, createGrabPaySession } from './paynow-grabpay';

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
export function resolveTierPriceCents(tier: string, billingCycle: 'monthly' | 'annual' | 'one_time'): number {
  const normalizedTier = tier.toUpperCase();
  const monthlyPrice = TIER_MONTHLY_PRICES_USD_CENTS[normalizedTier] ?? 9900;

  if (billingCycle === 'annual') {
    return monthlyPrice * 10; // 2 months free on annual commitment
  }

  return monthlyPrice;
}

/**
 * Dispatches a localized payment intent.
 * Handles FX hedging calculation, tax compliance, and rail-specific payload generation.
 */
export async function dispatchLocalizedPaymentIntent(
  input: LocalizedPaymentIntentInput,
  customRates?: Record<SupportedCurrency, number>,
): Promise<LocalizedPaymentIntentResult & {
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
}> {
  const {
    tier,
    billingCycle,
    rail,
    currency,
    billingCountry,
    taxId,
    customerType,
    orgId,
    userId,
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

  let qrPayload: string | undefined;
  let qrImageUrl: string | undefined;
  let mandateReference: string | undefined;
  let checkoutUrl: string | undefined;

  // 4. Dispatch to localized rail
  switch (rail) {
    case 'SEPA_DIRECT_DEBIT': {
      if (!input.iban) {
        throw new Error('IBAN is required for SEPA Direct Debit');
      }
      const mandate = generateSepaMandate({
        creditorId: DEFAULT_SEPA_CREDITOR_ID,
        creditorName: DEFAULT_SEPA_CREDITOR_NAME,
        debtorName: input.customerName,
        debtorIban: input.iban,
        debtorBic: input.bic,
        mandateReference: `SAF-SEPA-${transactionId.slice(-8).toUpperCase()}`,
        isRecurring: billingCycle !== 'one_time',
      });
      mandateReference = mandate.mandateReference;
      break;
    }

    case 'PROMPTPAY': {
      const recipient = input.mobileNumber ?? DEFAULT_PROMPTPAY_RECIPIENT;
      const promptPayQr = generatePromptPayQrPayload({
        recipientId: recipient,
        amount: totalAmount,
        transactionReference: transactionId,
      });
      qrPayload = promptPayQr.qrString;
      qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`;
      break;
    }

    case 'PAYNOW': {
      const payNowQr = generatePayNowQrPayload({
        proxyType: 'uen',
        proxyValue: DEFAULT_PAYNOW_UEN,
        amount: totalAmount,
        reference: transactionId,
      });
      qrPayload = payNowQr.qrString;
      qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrPayload)}`;
      break;
    }

    case 'GRABPAY': {
      const session = createGrabPaySession({
        orgId,
        userId,
        amount: totalAmount,
        currency,
        idempotencyKey: input.idempotencyKey,
      });
      checkoutUrl = session.checkoutUrl;
      break;
    }

    case 'PAYOS_VIETQR': {
      // VietQR standard NAPAS 247 payload format
      const roundedVnd = Math.round(totalAmount);
      qrPayload = `00020101021238570010A000000727012700069704220113190367898880220208QRIBFTTA530370454${roundedVnd.toString().length.toString().padStart(2, '0')}${roundedVnd}5802VN62${(transactionId.length + 4).toString().padStart(2, '0')}08${transactionId}6304`;
      qrImageUrl = `https://api.vietqr.io/image/970422-19036789888-print.png?amount=${roundedVnd}&addInfo=${transactionId}&accountName=SOPHIA%20AI%20FACTORY`;
      break;
    }

    case 'NOWPAYMENTS_CRYPTO': {
      checkoutUrl = `https://nowpayments.io/payment/?iid=${transactionId}&currency=${currency}&price_amount=${totalAmount}`;
      break;
    }

    default: {
      const exhaustiveCheck: never = rail;
      throw new Error(`Unhandled payment rail: ${String(exhaustiveCheck)}`);
    }
  }

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
    qrPayload,
    qrImageUrl,
    mandateReference,
    checkoutUrl,
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

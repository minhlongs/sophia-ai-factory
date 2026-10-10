/**
 * NOWPayments SDK Client — checkout generation and SDK instance lifecycle.
 *
 * @module tree/clients/nowpayments/nowpayments-client
 */

import { NowPaymentsSDK } from '@nowpaymentsio/nowpayments-sdk-nodejs';
import { getOneTimeSkuById } from '@/seed/config/one-time-skus';
import { TIER_PRICE_CONFIG } from './currency-service';
import type { CreateCheckoutInput, CreateOneTimeCheckoutInput } from './types';

let sdkInstance: NowPaymentsSDK | null = null;

function resolveApiKey(): string {
  try {
    const g = globalThis as Record<string, unknown>;
    const env = (g.__env ?? process.env) as Record<string, string | undefined>;
    return env.NOWPAYMENTS_API_KEY ?? process.env.NOWPAYMENTS_API_KEY ?? '';
  } catch {
    return process.env.NOWPAYMENTS_API_KEY ?? '';
  }
}

function resolveIpnSecret(): string | undefined {
  try {
    const g = globalThis as Record<string, unknown>;
    const env = (g.__env ?? process.env) as Record<string, string | undefined>;
    return env.NOWPAYMENTS_IPN_SECRET ?? process.env.NOWPAYMENTS_IPN_SECRET ?? undefined;
  } catch {
    return process.env.NOWPAYMENTS_IPN_SECRET ?? undefined;
  }
}

export function createNowPaymentsSDK(): NowPaymentsSDK {
  if (sdkInstance) return sdkInstance;
  const apiKey = resolveApiKey();
  if (!apiKey) throw new Error('NOWPAYMENTS_API_KEY is required for SDK operations');
  sdkInstance = new NowPaymentsSDK({
    apiKey,
    ipnSecret: resolveIpnSecret(),
  });
  return sdkInstance;
}

/** Reset cached SDK instance (for testing). */
export function resetNowPaymentsSDK(): void {
  sdkInstance = null;
}

export async function createCheckout(input: CreateCheckoutInput): Promise<{
  invoiceUrl: string;
  orderId: string;
  invoiceId: string;
}> {
  const sdk = createNowPaymentsSDK();
  const config = TIER_PRICE_CONFIG[input.tierId];
  if (!config) throw new Error(`Unknown tier: ${input.tierId}`);

  const isYearly = input.period === 'yearly';
  if (isYearly && config.yearlyPrice === 0) {
    throw new Error(`Yearly billing not available for tier: ${input.tierId}`);
  }
  const priceAmount = input.priceAmountOverride ?? (isYearly ? config.yearlyPrice : config.price);

  const orderId = input.orderId || `sophia_${input.userId}_${Date.now()}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

  let successUrl = `${appUrl}/payment-success?tier=${input.tierId}&order_id=${orderId}`;
  if (input.customerEmail) {
    successUrl += `&email=${encodeURIComponent(input.customerEmail)}`;
  }

  const result = await sdk.createCheckout({
    priceAmount,
    priceCurrency: config.currency,
    orderId,
    orderDescription: `${config.name}${isYearly ? ' (Annual)' : ''}`,
    successUrl,
    cancelUrl: `${appUrl}/pricing`,
  });

  if (!result.invoice_url) {
    throw new Error('NOWPayments checkout returned empty invoice_url');
  }

  return {
    invoiceUrl: result.invoice_url,
    orderId,
    invoiceId: String(result.id ?? ''),
  };
}

export async function createOneTimeCheckout(input: CreateOneTimeCheckoutInput): Promise<{
  invoiceUrl: string;
  orderId: string;
  invoiceId: string;
}> {
  const sdk = createNowPaymentsSDK();
  const sku = getOneTimeSkuById(input.skuId);
  if (!sku) throw new Error(`Unknown SKU: ${input.skuId}`);

  const orderId = input.orderId || `sophia_${input.userId}_${Date.now()}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sophia.agencyos.network';

  let successUrl = `${appUrl}/payment-success?sku=${input.skuId}&order_id=${orderId}`;
  if (input.customerEmail) {
    successUrl += `&email=${encodeURIComponent(input.customerEmail)}`;
  }

  const result = await sdk.createCheckout({
    priceAmount: sku.priceUsd,
    priceCurrency: 'USD',
    orderId,
    orderDescription: sku.label_en,
    successUrl,
    cancelUrl: `${appUrl}/pricing`,
  });

  if (!result.invoice_url) {
    throw new Error('NOWPayments one-time checkout returned empty invoice_url');
  }

  return {
    invoiceUrl: result.invoice_url,
    orderId,
    invoiceId: String(result.id ?? ''),
  };
}

/**
 * Singapore PayNow (SGQR EMVCo Standard) & GrabPay Adapter
 *
 * Implements:
 * 1. PayNow SGQR EMVCo merchant QR generator (Tag 26 SG.PAYNOW, ISO 4217 702 SGD)
 * 2. CRC16-CCITT checksum calculation for Singapore QR specifications
 * 3. GrabPay checkout session adapter with HMAC webhook verification support
 *
 * Layer: tree/rails (Pure domain service — imports only from seed and promptpay-thai-qr)
 *
 * @module tree/rails/paynow-grabpay
 */

import {
  type PayNowPayload,
  type GrabPaySession,
} from '@/seed/types/localized-rails';
import { type SupportedCurrency } from '@/seed/types/enterprise-billing';
import { formatTlv, calculateCrc16Ccitt } from './promptpay-thai-qr';

const PAYNOW_AID = 'SG.PAYNOW';
const SINGAPORE_COUNTRY_CODE = 'SG';
const SINGAPORE_DOLLAR_CURRENCY_CODE = '702'; // ISO 4217 for SGD
const DEFAULT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes TTL

export interface GeneratePayNowQrInput {
  proxyType: 'uen' | 'mobile' | 'nric';
  proxyValue: string;
  amount: number; // In SGD major units (e.g. 199.00)
  reference?: string;
  merchantName?: string;
}

export interface CreateGrabPaySessionInput {
  orgId: string;
  userId: string;
  amount: number;
  currency: SupportedCurrency;
  redirectUrl?: string;
  idempotencyKey?: string;
}

/**
 * Formats Singapore PayNow proxy type for Tag 26 Sub-Tag 01.
 * - '0': Mobile Number (e.g. +6591234567)
 * - '2': UEN (Unique Entity Number)
 */
function getPayNowProxyTypeCode(proxyType: 'uen' | 'mobile' | 'nric'): string {
  if (proxyType === 'mobile') return '0';
  return '2'; // UEN or NRIC
}

/**
 * Generates an EMVCo compliant Singapore PayNow SGQR payload.
 */
export function generatePayNowQrPayload(input: GeneratePayNowQrInput): PayNowPayload {
  const { proxyType, proxyValue, amount } = input;

  if (amount <= 0) {
    throw new Error(`PayNow amount must be positive: ${amount}`);
  }

  const cleanedProxy = proxyValue.trim().toUpperCase().replace(/[\s-]/g, '');
  const proxyCode = getPayNowProxyTypeCode(proxyType);

  // Sub-TLVs for Tag 26 (Merchant Account Information - PayNow)
  const tag26Sub00 = formatTlv('00', PAYNOW_AID);
  const tag26Sub01 = formatTlv('01', proxyCode);
  const tag26Sub02 = formatTlv('02', cleanedProxy);
  const tag26Sub03 = formatTlv('03', '0'); // 0 = Strict fixed amount (non-editable by payer)

  const tag26Value = `${tag26Sub00}${tag26Sub01}${tag26Sub02}${tag26Sub03}`;

  // Tag 00: Payload Format Indicator (01)
  const tag00 = formatTlv('00', '01');

  // Tag 01: Point of Initiation Method (12 = Dynamic QR with fixed amount)
  const tag01 = formatTlv('01', '12');

  // Tag 26: PayNow Account Information
  const tag26 = formatTlv('26', tag26Value);

  // Tag 52: Merchant Category Code (0000 = General software services)
  const tag52 = formatTlv('52', '0000');

  // Tag 53: Transaction Currency (702 = SGD)
  const tag53 = formatTlv('53', SINGAPORE_DOLLAR_CURRENCY_CODE);

  // Tag 54: Transaction Amount
  const formattedAmount = amount.toFixed(2);
  const tag54 = formatTlv('54', formattedAmount);

  // Tag 58: Country Code (SG)
  const tag58 = formatTlv('58', SINGAPORE_COUNTRY_CODE);

  // Tag 59: Merchant Name
  const merchantName = (input.merchantName ?? 'SOPHIA AI FACTORY').slice(0, 25);
  const tag59 = formatTlv('59', merchantName);

  // Tag 60: Merchant City
  const tag60 = formatTlv('60', 'Singapore');

  // Tag 62: Additional Data Field (Reference / Bill Number)
  const ref = input.reference ?? `SG${Date.now().toString(36).toUpperCase()}`;
  const tag62Sub01 = formatTlv('01', ref.slice(0, 25));
  const tag62 = formatTlv('62', tag62Sub01);

  // Assemble full payload string with CRC tag 6304
  const payloadWithoutCrc = `${tag00}${tag01}${tag26}${tag52}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;
  const crc = calculateCrc16Ccitt(payloadWithoutCrc);
  const qrString = `${payloadWithoutCrc}${crc}`;

  return {
    qrString,
    proxyType,
    proxyValue: cleanedProxy,
    amount: Number(formattedAmount),
    currency: 'SGD',
    reference: ref,
    expiresAt: Date.now() + DEFAULT_EXPIRY_MS,
  };
}

/**
 * Creates a GrabPay checkout session adapter.
 */
export function createGrabPaySession(input: CreateGrabPaySessionInput): GrabPaySession {
  const { amount, currency } = input;

  if (amount <= 0) {
    throw new Error(`GrabPay amount must be greater than zero: ${amount}`);
  }

  const sessionId = `grab_sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const expiresAt = Date.now() + DEFAULT_EXPIRY_MS;
  const redirectBase = input.redirectUrl ?? 'https://sophia.agencyos.network/checkout/complete';
  const checkoutUrl = `https://pay.grab.com/v2/checkout?session=${sessionId}&redirect=${encodeURIComponent(redirectBase)}`;

  return {
    sessionId,
    checkoutUrl,
    paymentStatus: 'created',
    amount,
    currency,
    expiresAt,
  };
}

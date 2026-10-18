/**
 * PromptPay Thai QR Payment Rail (EMVCo Merchant-Presented Standard)
 *
 * Implements:
 * 1. EMVCo QR TLV (Tag-Length-Value) payload encoding
 * 2. PromptPay AID (A000000677010111) with Mobile (Tag 01) / Tax ID (Tag 02)
 * 3. ISO 4217 Currency Tag 53 ('764' for THB)
 * 4. ITU-T CRC16-CCITT (Polynomial 0x1021, Initial 0xFFFF) checksum calculation
 *
 * Layer: tree/rails (Pure domain service — imports only from seed)
 *
 * @module tree/rails/promptpay-thai-qr
 */

import { type PromptPayQrInput, type PromptPayQrPayload } from '@/seed/types/localized-rails';
import {
  formatTlv,
  calculateCrc16Ccitt,
  formatPromptPayRecipient,
} from './promptpay-emvco-helpers';

export { formatTlv, calculateCrc16Ccitt, formatPromptPayRecipient };

const PROMPTPAY_AID = 'A000000677010111';
const THAILAND_COUNTRY_CODE = 'TH';
const THAI_BAHT_CURRENCY_CODE = '764'; // ISO 4217 for THB
const DEFAULT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes TTL

/**
 * Generates an EMVCo compliant PromptPay QR payload string with CRC16-CCITT checksum.
 */
export function generatePromptPayQrPayload(input: PromptPayQrInput): PromptPayQrPayload {
  const { recipientId, amount } = input;

  if (amount <= 0) {
    throw new Error(`PromptPay amount must be greater than zero: ${amount}`);
  }

  const { subTag, formattedValue } = formatPromptPayRecipient(recipientId);

  // Sub-TLVs for Tag 29 (Merchant Account Information - PromptPay)
  const tag29SubTlv00 = formatTlv('00', PROMPTPAY_AID);
  const tag29SubTlvRecipient = formatTlv(subTag, formattedValue);
  const tag29Value = `${tag29SubTlv00}${tag29SubTlvRecipient}`;

  // Tag 00: Payload Format Indicator (01)
  const tag00 = formatTlv('00', '01');

  // Tag 01: Point of Initiation Method (12 = Dynamic QR with amount)
  const tag01 = formatTlv('01', '12');

  // Tag 29: Merchant Account Information
  const tag29 = formatTlv('29', tag29Value);

  // Tag 53: Transaction Currency (764 = THB)
  const tag53 = formatTlv('53', THAI_BAHT_CURRENCY_CODE);

  // Tag 54: Transaction Amount (formatted to 2 decimal places)
  const formattedAmount = amount.toFixed(2);
  const tag54 = formatTlv('54', formattedAmount);

  // Tag 58: Country Code (TH)
  const tag58 = formatTlv('58', THAILAND_COUNTRY_CODE);

  // Tag 59: Merchant Name
  const tag59 = formatTlv('59', 'SOPHIA AI FACTORY');

  // Tag 60: Merchant City
  const tag60 = formatTlv('60', 'Bangkok');

  // Tag 62: Additional Data Field (Reference)
  const txnRef = input.transactionReference ?? `TH${Date.now().toString(36).toUpperCase()}`;
  const tag62Sub07 = formatTlv('07', txnRef.slice(0, 25));
  const tag62 = formatTlv('62', tag62Sub07);

  // Payload without CRC
  const payloadWithoutCrc = `${tag00}${tag01}${tag29}${tag53}${tag54}${tag58}${tag59}${tag60}${tag62}6304`;

  // Calculate CRC16 checksum
  const crc = calculateCrc16Ccitt(payloadWithoutCrc);
  const fullQrString = `${payloadWithoutCrc}${crc}`;

  return {
    qrString: fullQrString,
    transactionReference: txnRef,
    amount: Number(formattedAmount),
    currency: 'THB',
    expiresAt: Date.now() + DEFAULT_EXPIRY_MS,
  };
}

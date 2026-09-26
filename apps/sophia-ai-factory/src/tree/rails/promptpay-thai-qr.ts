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

const PROMPTPAY_AID = 'A000000677010111';
const THAILAND_COUNTRY_CODE = 'TH';
const THAI_BAHT_CURRENCY_CODE = '764'; // ISO 4217 for THB
const DEFAULT_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes TTL

/**
 * Formats an EMVCo TLV (Tag-Length-Value) segment.
 */
export function formatTlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${tag}${len}${value}`;
}

/**
 * Computes CRC16-CCITT (Polynomial 0x1021, Initial 0xFFFF) per EMVCo QR Specification.
 */
export function calculateCrc16Ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    const code = data.charCodeAt(i);
    crc ^= (code << 8);
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Formats a recipient identifier for PromptPay Tag 29.
 * - Mobile: 10 digits (e.g. 0812345678) -> 0066812345678 (13 digits)
 * - National ID / Tax ID: 13 digits
 * - e-Wallet ID: 15 digits
 */
export function formatPromptPayRecipient(recipient: string): { subTag: string; formattedValue: string } {
  const cleaned = recipient.replace(/[\s-]/g, '');

  // 1. Mobile number starting with 0 (e.g. 0812345678 -> 10 digits)
  if (/^0[0-9]{9}$/.test(cleaned)) {
    const mobileWithoutZero = cleaned.substring(1);
    const formatted = `0066${mobileWithoutZero}`;
    return { subTag: '01', formattedValue: formatted };
  }

  // Mobile with 66 prefix (e.g. 66812345678 -> 11 digits)
  if (/^66[0-9]{9}$/.test(cleaned)) {
    const formatted = `00${cleaned}`;
    return { subTag: '01', formattedValue: formatted };
  }

  // 2. National ID / Tax ID (13 digits)
  if (/^[0-9]{13}$/.test(cleaned)) {
    return { subTag: '02', formattedValue: cleaned };
  }

  // 3. E-Wallet ID (15 digits)
  if (/^[0-9]{15}$/.test(cleaned)) {
    return { subTag: '03', formattedValue: cleaned };
  }

  throw new Error(
    `Invalid PromptPay recipient: "${recipient}". Must be 10-digit mobile, 13-digit National ID/Tax ID, or 15-digit e-Wallet ID.`,
  );
}

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

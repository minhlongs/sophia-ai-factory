/**
 * VietQR URL & RFC 4180 CSV Formatting Helpers for Fiat Domestic Rail
 *
 * Layer: land/payouts/dual-rail
 * @module land/payouts/dual-rail/fiat-rail-formatters
 */

import { DEFAULT_USD_TO_VND_RATE } from './types';

export const VIETQR_CSV_HEADERS = [
  'batch_id',
  'payout_id',
  'affiliate_id',
  'bank_bin',
  'account_number',
  'account_name',
  'amount_usd',
  'exchange_rate_vnd',
  'amount_vnd',
  'transfer_memo',
  'vietqr_url',
] as const;

export function getExchangeRateVnd(): number {
  const envDouble = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
  const envRate = envDouble?.USD_TO_VND || process.env.USD_TO_VND;
  const parsed = Number(envRate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_VND_RATE;
}

export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return `"${str}"`;
}

export function buildVietQrPaymentUrl(
  bin: string,
  accountNumber: string,
  amountVnd: number,
  memo: string,
  accountName: string,
): string {
  const cleanBin = bin.trim().replace(/\D/g, '');
  const cleanAcc = accountNumber.trim().replace(/\s+/g, '');
  const encodedMemo = encodeURIComponent(memo.trim());
  const encodedName = encodeURIComponent(accountName.trim());
  const safeAmount = Math.max(0, Math.round(amountVnd));

  return `https://img.vietqr.io/image/${cleanBin}-${cleanAcc}-compact2.png?amount=${safeAmount}&addInfo=${encodedMemo}&accountName=${encodedName}`;
}

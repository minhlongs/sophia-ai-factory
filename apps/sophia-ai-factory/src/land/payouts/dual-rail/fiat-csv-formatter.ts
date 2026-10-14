/**
 * Fiat / Vietnam Domestic Rail (VietQR / NAPAS 247) CSV & URL Builders.
 *
 * Layer: land/payouts/dual-rail
 * Allowed imports: @/seed/*, @/land/payouts/*
 * @module land/payouts/dual-rail/fiat-csv-formatter
 */

import { fromCents } from '../commission-cents';
import {
  DEFAULT_USD_TO_VND_RATE,
  type PayoutBatchItem,
} from './types';

/**
 * Retrieve current USD to VND exchange rate.
 * Checks environment variable or uses standard fallback.
 */
export function getExchangeRateVnd(): number {
  const envDouble = (globalThis as unknown as Record<string, Record<string, unknown>>).__env__;
  const envRate = envDouble?.USD_TO_VND || process.env.USD_TO_VND;
  const parsed = Number(envRate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_USD_TO_VND_RATE;
}

/**
 * Generate RFC 4180 escaped CSV field.
 */
export function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Construct an instant VietQR payment link for quick-scan mobile banking (VietQR / NAPAS 247).
 */
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

/**
 * Generate standard RFC 4180 CSV export for Vietnamese domestic banking batches (NAPAS 247).
 */
export function generateVietQrCsv(
  items: PayoutBatchItem[],
  options?: { exchangeRateVnd?: number; batchId?: string },
): string {
  const rate = options?.exchangeRateVnd && options.exchangeRateVnd > 0
    ? options.exchangeRateVnd
    : getExchangeRateVnd();
  const batchId = options?.batchId || `BATCH_${Date.now()}`;

  const headers = [
    'STT',
    'Ma_Lo',
    'Ma_Doi_Tac',
    'Ma_Ngan_Hang_BIN',
    'So_Tai_Khoan',
    'Ten_Chu_Tai_Khoan',
    'So_Tien_VND',
    'So_Tien_USD',
    'Noi_Dung_Chuyen_Khoan',
    'Trang_Thai',
  ];

  const rows: string[] = [];
  let idx = 1;

  for (const item of items) {
    if (item.rail !== 'VIETQR' || !item.bankDetails) {
      continue;
    }

    const { bin, accountNumber, accountName } = item.bankDetails;
    const amountUsd = fromCents(item.amountCents);
    const amountVnd = item.bankDetails.amountVnd > 0
      ? item.bankDetails.amountVnd
      : Math.round(amountUsd * rate);
    const memo = item.memo || `SOPHIA AFF ${item.partnerCode}`;

    const csvRow = [
      escapeCsvField(idx++),
      escapeCsvField(batchId),
      escapeCsvField(item.partnerCode),
      escapeCsvField(bin),
      escapeCsvField(accountNumber),
      escapeCsvField(accountName),
      escapeCsvField(amountVnd),
      escapeCsvField(amountUsd.toFixed(2)),
      escapeCsvField(memo),
      escapeCsvField('PENDING_TRANSFER'),
    ].join(',');

    rows.push(csvRow);
  }

  return [headers.join(','), ...rows].join('\n');
}

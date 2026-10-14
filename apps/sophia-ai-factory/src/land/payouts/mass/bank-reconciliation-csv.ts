/**
 * RFC 4180 Bank Reconciliation CSV export helper for mass payouts.
 * @module land/payouts/mass/bank-reconciliation-csv
 */

import { fromCents } from '../commission-cents';
import type { BankReconciliationRecord } from './types';

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return `"${str}"`;
}

/**
 * Generate standard RFC 4180 Bank Reconciliation CSV export fallback
 * for domestic banking and accounting settlement.
 */
export function exportBankReconciliationCsv(records: BankReconciliationRecord[]): string {
  const headers = [
    'batch_id',
    'affiliate_id',
    'partner_code',
    'payout_method',
    'recipient_account_or_address',
    'amount_cents',
    'amount_usd',
    'amount_vnd',
    'status',
    'created_at',
  ];

  const rows = records.map((r) => {
    const amountUsd = fromCents(r.amountCents).toFixed(2);
    const rate = r.vndRate ?? 25450;
    const amountVnd = Math.round(fromCents(r.amountCents) * rate);
    const createdAtIso = r.createdAt
      ? typeof r.createdAt === 'number'
        ? new Date(r.createdAt).toISOString()
        : String(r.createdAt)
      : new Date().toISOString();

    return [
      escapeCsvField(r.batchId),
      escapeCsvField(r.affiliateId),
      escapeCsvField(r.partnerCode),
      escapeCsvField(r.payoutMethod),
      escapeCsvField(r.recipientAddressOrAccount),
      escapeCsvField(r.amountCents),
      escapeCsvField(amountUsd),
      escapeCsvField(amountVnd),
      escapeCsvField(r.status),
      escapeCsvField(createdAtIso),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

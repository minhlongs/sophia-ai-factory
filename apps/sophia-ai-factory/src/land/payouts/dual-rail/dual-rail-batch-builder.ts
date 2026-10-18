/**
 * Dual-Rail Affiliate Payout Batch Query & Item Mapper
 *
 * Extracted from dual-rail-payout-engine.ts for single-responsibility modularization.
 *
 * Layer: land/payouts/dual-rail
 */

import { fromCents } from '../commission-cents';
import type { PayoutRail, PayoutBatchItem } from './types';

export interface AffiliatePartnerPayoutRow {
  id: string;
  partner_code: string;
  payout_rail: string;
  pending_payout_cents: number;
  usdt_trc20_address_encrypted: string | null;
  bank_bin: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
}

export function buildEligibleAffiliatePartnersQuery(
  minCents: number,
  targetRail: PayoutRail | 'COMBINED',
  partnerIds?: string[]
): { query: string; binds: (string | number)[] } {
  let query = `
    SELECT
      id,
      partner_code,
      payout_rail,
      pending_payout_cents,
      usdt_trc20_address_encrypted,
      bank_bin,
      bank_account_number,
      bank_account_name
    FROM affiliate_partners
    WHERE status = 'active'
      AND pending_payout_cents >= ?
  `;
  const binds: (string | number)[] = [minCents];

  if (partnerIds && partnerIds.length > 0) {
    const placeholders = partnerIds.map(() => '?').join(',');
    query += ` AND id IN (${placeholders})`;
    binds.push(...partnerIds);
  }

  if (targetRail !== 'COMBINED') {
    query += ` AND payout_rail = ?`;
    binds.push(targetRail);
  }

  query += ` ORDER BY pending_payout_cents DESC`;
  return { query, binds };
}

export function mapAffiliateRowsToBatchItems(
  rows: AffiliatePartnerPayoutRow[],
  exchangeRate: number
): { items: PayoutBatchItem[]; totalUsdtAmount: number; totalVndAmount: number } {
  const items: PayoutBatchItem[] = [];
  let totalUsdtAmount = 0;
  let totalVndAmount = 0;

  for (const row of rows) {
    const amountCents = row.pending_payout_cents;
    const amountUsd = fromCents(amountCents);
    const rail: PayoutRail = row.payout_rail === 'VIETQR' ? 'VIETQR' : 'USDT';

    if (rail === 'VIETQR') {
      const amountVnd = Math.round(amountUsd * exchangeRate);
      totalVndAmount += amountVnd;

      items.push({
        affiliateId: row.id,
        partnerCode: row.partner_code,
        amountUsd,
        amountCents,
        rail: 'VIETQR',
        bankDetails: {
          bin: row.bank_bin || '970422',
          accountNumber: row.bank_account_number || '',
          accountName: row.bank_account_name || row.partner_code,
          amountVnd,
        },
        memo: `SOPHIA AFF ${row.partner_code}`,
      });
    } else {
      totalUsdtAmount += amountUsd;
      items.push({
        affiliateId: row.id,
        partnerCode: row.partner_code,
        amountUsd,
        amountCents,
        rail: 'USDT',
        usdtAddress: row.usdt_trc20_address_encrypted || undefined,
        memo: `SOPHIA USDT ${row.partner_code}`,
      });
    }
  }

  return { items, totalUsdtAmount, totalVndAmount };
}

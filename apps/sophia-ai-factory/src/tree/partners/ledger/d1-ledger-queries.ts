/**
 * Cross-Border Partner Ledger Read & Summary Queries
 *
 * Layer: tree/partners/ledger
 * @module tree/partners/ledger/d1-ledger-queries
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerCrossBorderLedgerEntry,
  CrossBorderPartnerSummary,
} from '@/seed/types/cross-border-ledger';

/**
 * Retrieve cross-border ledger entries for a partner.
 */
export async function getCrossBorderLedgerByPartner(
  db: D1Database,
  partnerId: string,
  limit = 50,
): Promise<PartnerCrossBorderLedgerEntry[]> {
  const result = await db
    .prepare(
      `SELECT * FROM partner_cross_border_ledger
       WHERE partner_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(partnerId, Math.max(1, Math.min(200, limit)))
    .all<PartnerCrossBorderLedgerEntry>();

  return (result.results ?? []) as PartnerCrossBorderLedgerEntry[];
}

/**
 * Compute partner financial summary across all cross-border commission entries.
 */
export async function getCrossBorderLedgerSummary(
  db: D1Database,
  partnerId: string,
): Promise<CrossBorderPartnerSummary> {
  const entries = await getCrossBorderLedgerByPartner(db, partnerId, 500);

  let totalGrossCents = 0;
  let totalWithheldCents = 0;
  let totalNetCents = 0;
  let accruedCount = 0;
  let settledCount = 0;
  const totalSettledLocalAmounts: Record<string, number> = {};

  for (const entry of entries) {
    totalGrossCents += entry.gross_commission_cents;
    totalWithheldCents += entry.wht_amount_cents;
    totalNetCents += entry.net_commission_cents;

    if (entry.status === 'accrued') {
      accruedCount++;
    } else if (entry.status === 'settled') {
      settledCount++;
      const curr = entry.payout_currency;
      totalSettledLocalAmounts[curr] = (totalSettledLocalAmounts[curr] ?? 0) + entry.net_payout_local_amount;
    }
  }

  return {
    partnerId,
    totalGrossCents,
    totalWithheldCents,
    totalNetCents,
    totalSettledLocalAmounts,
    accruedCount,
    settledCount,
  };
}

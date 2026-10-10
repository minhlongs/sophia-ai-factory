/**
 * ledger-writer.ts — Land Layer
 * D1 database persistence for Tier 1 and Tier 2 affiliate commissions
 */

import type { D1Database } from '@/seed/db/client';

export interface InsertCommissionEntryParams {
  db: D1Database;
  ledgerId: string;
  tenantId: string;
  partnerId: string;
  conversionEventId: string;
  offerId: string;
  orderAmountCents: number;
  ratePct: number;
  commissionCents: number;
  payableAt: number;
  nowSec: number;
  parentConversionId?: string;
}

export async function insertLedgerRecord(params: InsertCommissionEntryParams): Promise<void> {
  const {
    db, ledgerId, tenantId, partnerId, conversionEventId,
    offerId, orderAmountCents, ratePct, commissionCents,
    payableAt, nowSec, parentConversionId,
  } = params;

  if (parentConversionId) {
    await db
      .prepare(
        `INSERT OR IGNORE INTO commission_ledger (
          id, tenant_id, affiliate_id, conversion_event_id, offer_id,
          gross_cents, commission_pct, commission_cents, withheld_cents,
          parent_conversion_id, status, payable_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', ?, ?, ?)`
      )
      .bind(
        ledgerId, tenantId, partnerId, conversionEventId, offerId,
        orderAmountCents, ratePct, commissionCents, parentConversionId,
        payableAt, nowSec, nowSec
      )
      .run();
  } else {
    await db
      .prepare(
        `INSERT OR IGNORE INTO commission_ledger (
          id, tenant_id, affiliate_id, conversion_event_id, offer_id,
          gross_cents, commission_pct, commission_cents, withheld_cents,
          status, payable_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending', ?, ?, ?)`
      )
      .bind(
        ledgerId, tenantId, partnerId, conversionEventId, offerId,
        orderAmountCents, ratePct, commissionCents, payableAt, nowSec, nowSec
      )
      .run();
  }

  await db
    .prepare(
      `UPDATE affiliate_partners
       SET pending_payout_cents = pending_payout_cents + ?,
           total_earnings_cents = total_earnings_cents + ?,
           updated_at = ?
       WHERE id = ?`
    )
    .bind(commissionCents, commissionCents, nowSec * 1000, partnerId)
    .run();
}

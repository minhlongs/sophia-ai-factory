/**
 * Positive Commission Credit Writer
 *
 * @module tree/affiliate/ledger/commission-writer
 */

import type { CommissionEntryInput, CommissionEntryResult } from './types';
import { calculatePayableAt } from './hold-calculator';

/**
 * Inserts a positive commission credit row into commission_ledger with status = 'pending'.
 * Idempotent: checks for existing network + external_conversion_id.
 */
export async function recordCommissionEntry(
  db: D1Database,
  input: CommissionEntryInput,
  nowMs = Date.now(),
): Promise<CommissionEntryResult> {
  const holdDays = input.holdDays ?? 14;
  const attributedAt = input.attributedAt ?? nowMs;
  const payableAt = input.payableAt ?? calculatePayableAt(attributedAt, holdDays);
  const ledgerId = input.id ?? `com_${input.externalConversionId}`;

  // 1. Idempotency pre-check
  try {
    const existing = await db
      .prepare(
        `SELECT id, affiliate_id, commission_cents, payable_at, network
         FROM commission_ledger
         WHERE network = ? AND external_conversion_id = ?
         LIMIT 1`,
      )
      .bind(input.network, input.externalConversionId)
      .first<{
        id: string;
        affiliate_id: string;
        commission_cents: number;
        payable_at: number;
        network: string;
      }>();

    if (existing) {
      return {
        success: true,
        duplicate: true,
        ledgerId: existing.id,
        affiliateId: existing.affiliate_id,
        commissionCents: existing.commission_cents,
        payableAt: existing.payable_at,
        network: existing.network,
      };
    }
  } catch {
    // If pre-check fails (e.g. table not initialized yet), proceed to insert
  }

  // 2. Insert pending credit row
  try {
    await db
      .prepare(
        `INSERT INTO commission_ledger (
          id, affiliate_id, network, external_conversion_id, sub_id,
          order_value_cents, commission_cents, status, hold_days,
          attributed_at, payable_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      )
      .bind(
        ledgerId,
        input.affiliateId,
        input.network,
        input.externalConversionId,
        input.subId ?? null,
        input.orderValueCents,
        input.commissionCents,
        holdDays,
        attributedAt,
        payableAt,
        nowMs,
      )
      .run();

    return {
      success: true,
      ledgerId,
      affiliateId: input.affiliateId,
      commissionCents: input.commissionCents,
      payableAt,
      network: input.network,
    };
  } catch (err: unknown) {
    const errStr = err instanceof Error ? err.message : String(err);
    if (errStr.includes('UNIQUE constraint failed') || errStr.includes('constraint')) {
      return {
        success: true,
        duplicate: true,
        ledgerId,
        affiliateId: input.affiliateId,
        commissionCents: input.commissionCents,
        payableAt,
        network: input.network,
      };
    }
    return {
      success: false,
      ledgerId,
      affiliateId: input.affiliateId,
      commissionCents: input.commissionCents,
      payableAt,
      network: input.network,
      error: errStr,
    };
  }
}

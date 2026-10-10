/**
 * Negative Clawback and Refund Adjustment Writer
 *
 * @module tree/affiliate/ledger/clawback-writer
 */

import type { LedgerAdjustmentResult } from './types';

/**
 * Appends a negative adjustment row for clawbacks/refunds.
 * Dual-entry invariant: NEVER mutates historical commission rows.
 * Formats external_conversion_id as claw_${parentConversionId}_${adjustmentSuffix}
 * to prevent index collision on multiple partial refunds.
 */
export async function recordClawbackAdjustment(
  db: D1Database,
  parentConversionId: string,
  refundCents: number,
  nowMs = Date.now(),
  _reason?: string,
): Promise<LedgerAdjustmentResult> {
  // 1. Locate original commission row by external_conversion_id or id
  const original = await db
    .prepare(
      `SELECT id, affiliate_id, network, external_conversion_id, commission_cents, status
       FROM commission_ledger
       WHERE external_conversion_id = ? OR id = ?
       LIMIT 1`,
    )
    .bind(parentConversionId, parentConversionId)
    .first<{
      id: string;
      affiliate_id: string;
      network: string;
      external_conversion_id: string;
      commission_cents: number;
      status: string;
    }>();

  if (!original) {
    return {
      success: false,
      amountCents: 0,
      status: 'clawback',
      parentConversionId,
      error: 'CONVERSION_NOT_FOUND',
    };
  }

  // 2. Compute negative adjustment amount (-|refundCents|)
  const negativeCents = -Math.abs(refundCents);
  const randSuffix = Math.random().toString(36).substring(2, 9);
  const adjustmentId = `adj_${randSuffix}_${nowMs}`;
  const clawbackExternalId = `claw_${parentConversionId}_${randSuffix}`;

  // 3. Append negative adjustment row
  await db
    .prepare(
      `INSERT INTO commission_ledger (
        id, affiliate_id, network, external_conversion_id,
        commission_cents, status, hold_days, attributed_at, payable_at, parent_id, created_at
      ) VALUES (?, ?, ?, ?, ?, 'clawback', 0, ?, ?, ?, ?)`,
    )
    .bind(
      adjustmentId,
      original.affiliate_id,
      original.network,
      clawbackExternalId,
      negativeCents,
      nowMs,
      nowMs,
      original.id,
      nowMs,
    )
    .run();

  return {
    success: true,
    adjustmentId,
    amountCents: negativeCents,
    status: 'clawback',
    parentConversionId,
  };
}

/**
 * @file ledger-insert-ops.ts
 * @description Insertion and error classification helpers for creator earnings ledger in D1.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { InsertLedgerParams } from './types';

export function isConstraintConflict(err: unknown): boolean {
  const str = String(err);
  return str.includes('UNIQUE') || str.includes('PRIMARY KEY') || str.includes('constraint');
}

export function isMissingColumnError(err: unknown): boolean {
  const str = String(err);
  return str.includes('no column named') || str.includes('has no column named');
}

export async function insertLedgerRecord(db: D1Database, p: InsertLedgerParams): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO creator_earnings_ledger (
          id, creator_id, source_type, reference_id, amount_cents, status, created_at,
          balance_after_cents, sequence_num, event_type, currency, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        p.ledgerId,
        p.creatorId,
        p.sourceType,
        p.referenceId,
        p.amountCents,
        p.status,
        p.nowMs,
        p.balanceAfterCents,
        p.sequenceNum,
        p.eventType,
        p.currency,
        p.metadataJson,
      )
      .run();
  } catch (insertErr: unknown) {
    if (!isMissingColumnError(insertErr)) {
      throw insertErr;
    }
    // Backward-compatible fallback for minimal/test harness schema
    await db
      .prepare(
        `INSERT INTO creator_earnings_ledger (
          id, creator_id, source_type, reference_id, amount_cents, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        p.ledgerId,
        p.creatorId,
        p.sourceType,
        p.referenceId,
        p.amountCents,
        p.status,
        p.nowMs,
      )
      .run();
  }
}

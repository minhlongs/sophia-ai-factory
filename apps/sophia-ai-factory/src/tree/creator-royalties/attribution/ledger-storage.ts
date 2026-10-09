/**
 * @file ledger-storage.ts
 * @description Storage query and insertion operations for creator earnings ledger in D1.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AccrueLedgerResult,
  InsertLedgerParams,
} from './types';

export function isConstraintConflict(err: unknown): boolean {
  const str = String(err);
  return str.includes('UNIQUE') || str.includes('PRIMARY KEY') || str.includes('constraint');
}

export function isMissingColumnError(err: unknown): boolean {
  const str = String(err);
  return str.includes('no column named') || str.includes('has no column named');
}

export async function probeExistingLedger(
  db: D1Database,
  creatorId: string,
  referenceId: string,
  eventType: string,
  sourceType: string,
  amountCents: number,
): Promise<AccrueLedgerResult | null> {
  try {
    const existing = await db
      .prepare(
        `SELECT id, balance_after_cents, amount_cents, sequence_num
         FROM creator_earnings_ledger
         WHERE creator_id = ? AND reference_id = ? AND (event_type = ? OR source_type = ?)
         LIMIT 1`,
      )
      .bind(creatorId, referenceId, eventType, sourceType)
      .first<{
        id: string;
        balance_after_cents?: number;
        amount_cents?: number;
        sequence_num?: number;
      }>();

    if (existing) {
      return {
        success: true,
        ledgerId: existing.id,
        newBalanceCents: existing.balance_after_cents ?? existing.amount_cents ?? amountCents,
        sequenceNum: existing.sequence_num ?? 1,
      };
    }
  } catch {
    // If table doesn't support complex where clause, proceed to insert
  }
  return null;
}

export async function fetchTailLedger(
  db: D1Database,
  creatorId: string,
): Promise<{ lastSeq: number; currentBalance: number }> {
  try {
    const tail = await db
      .prepare(
        `SELECT sequence_num, balance_after_cents, amount_cents
         FROM creator_earnings_ledger
         WHERE creator_id = ?
         ORDER BY sequence_num DESC, created_at DESC
         LIMIT 1`,
      )
      .bind(creatorId)
      .first<{
        sequence_num?: number;
        balance_after_cents?: number;
        amount_cents?: number;
      }>();

    if (tail) {
      return {
        lastSeq: tail.sequence_num ?? 0,
        currentBalance: tail.balance_after_cents ?? tail.amount_cents ?? 0,
      };
    }
  } catch {
    // Fallback for schemas without sequence_num column
  }
  return { lastSeq: 0, currentBalance: 0 };
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

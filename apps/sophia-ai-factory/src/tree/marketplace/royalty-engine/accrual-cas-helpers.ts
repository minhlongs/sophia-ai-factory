/**
 * @file accrual-cas-helpers.ts
 * @description D1 query and OCC CAS helpers for creator royalty accruals.
 * @layer tree
 */

import type { RoyaltyAccrualInput, RoyaltyAccrualResult } from '../types';
import { DEFAULT_ROYALTY_PCT } from './constants';

export async function probeExistingRoyaltyAccrual(
  db: RoyaltyAccrualInput['db'],
  creatorId: string,
  activationId: string,
  eventType: string,
  split: { creatorCents: number; platformCents: number },
): Promise<RoyaltyAccrualResult | null> {
  const existing = await db
    .prepare(
      `SELECT id, balance_after_cents, sequence_num, amount_cents
       FROM creator_earnings_ledger
       WHERE creator_id = ? AND reference_id = ? AND event_type = ?
       LIMIT 1`,
    )
    .bind(creatorId, activationId, eventType)
    .first<{
      id: string;
      balance_after_cents?: number;
      sequence_num?: number;
      amount_cents?: number;
    }>();

  if (!existing) return null;

  return {
    success: true,
    activationId,
    creatorCents: existing.amount_cents ?? split.creatorCents,
    platformCents: split.platformCents,
    ledgerId: existing.id,
    sequenceNum: existing.sequence_num ?? 1,
    balanceAfterCents: existing.balance_after_cents ?? split.creatorCents,
  };
}

export async function insertRoyaltyLedgerEntry(
  input: RoyaltyAccrualInput,
  activationId: string,
  eventType: string,
  sourceType: string,
  split: { creatorCents: number; platformCents: number },
  nowMs: number,
): Promise<RoyaltyAccrualResult> {
  const tail = await input.db
    .prepare(
      `SELECT sequence_num, balance_after_cents
       FROM creator_earnings_ledger
       WHERE creator_id = ?
       ORDER BY sequence_num DESC, created_at DESC
       LIMIT 1`,
    )
    .bind(input.creatorId)
    .first<{ sequence_num?: number; balance_after_cents?: number }>();

  const nextSeq = (tail?.sequence_num ?? 0) + 1;
  const nextBal = (tail?.balance_after_cents ?? 0) + split.creatorCents;
  const ledgerId = `led_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;

  const metadataJson = JSON.stringify({
    templateId: input.templateId,
    activatingUserId: input.activatingUserId,
    tenantId: input.tenantId,
    videoJobId: input.videoJobId,
    priceCents: input.priceCents,
    creatorCents: split.creatorCents,
    platformCents: split.platformCents,
    royaltyPct: input.royaltyPct ?? DEFAULT_ROYALTY_PCT,
  });

  await input.db
    .prepare(
      `INSERT INTO creator_earnings_ledger (
        id, creator_id, amount_cents, currency, event_type, source_type,
        reference_id, balance_after_cents, status, sequence_num,
        metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      ledgerId,
      input.creatorId,
      split.creatorCents,
      'USD',
      eventType,
      sourceType,
      activationId,
      nextBal,
      'pending',
      nextSeq,
      metadataJson,
      nowMs,
    )
    .run();

  return {
    success: true,
    activationId,
    creatorCents: split.creatorCents,
    platformCents: split.platformCents,
    ledgerId,
    sequenceNum: nextSeq,
    balanceAfterCents: nextBal,
  };
}

export function isSqliteConstraintError(errStr: string): boolean {
  return (
    errStr.includes('UNIQUE') ||
    errStr.includes('PRIMARY KEY') ||
    errStr.includes('constraint') ||
    errStr.includes('SQLITE_CONSTRAINT')
  );
}

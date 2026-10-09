/**
 * @file ledger-accrual.ts
 * @description Optimistic Concurrency Control (OCC) CAS engine for creator earnings ledger.
 * @layer tree
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  AccrueLedgerInput,
  AccrueLedgerResult,
} from './types';
import {
  isConstraintConflict,
  probeExistingLedger,
  fetchTailLedger,
  insertLedgerRecord,
} from './ledger-storage';

async function waitCasJitter(attempt: number): Promise<void> {
  const maxDelay = 10 * Math.pow(2, attempt);
  const delay = Math.floor(Math.random() * maxDelay) + Math.floor(Math.random() * 15);
  await new Promise((r) => setTimeout(r, delay));
}

async function attemptCasInsert(
  db: D1Database,
  entry: AccrueLedgerInput,
  attempt: number,
  maxRetries: number,
  nowMs: number,
  probe: () => Promise<AccrueLedgerResult | null>,
): Promise<AccrueLedgerResult | null> {
  const { lastSeq, currentBalance } = await fetchTailLedger(db, entry.creatorId);
  const nextSeq = lastSeq + 1;
  const nextBalance = currentBalance + entry.amountCents;
  const ledgerId = `led_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;

  try {
    await insertLedgerRecord(db, {
      ledgerId,
      creatorId: entry.creatorId,
      sourceType: entry.sourceType ?? 'blueprint_remix',
      referenceId: entry.referenceId,
      amountCents: entry.amountCents,
      status: entry.status ?? 'pending',
      nowMs,
      balanceAfterCents: nextBalance,
      sequenceNum: nextSeq,
      eventType: entry.eventType ?? 'royalty_accrual',
      currency: entry.currency ?? 'USD',
      metadataJson: JSON.stringify(entry.metadata ?? {}),
    });

    return {
      success: true,
      ledgerId,
      newBalanceCents: nextBalance,
      sequenceNum: nextSeq,
    };
  } catch (insertErr: unknown) {
    if (isConstraintConflict(insertErr)) {
      const conflictExisting = await probe();
      if (conflictExisting) return conflictExisting;
    }

    if (attempt < maxRetries - 1) {
      await waitCasJitter(attempt);
    }
    return null;
  }
}

/**
 * Accrues an entry into creator_earnings_ledger using Optimistic Concurrency Control (OCC)
 * Compare-And-Swap (CAS) with monotonic sequence numbers and idempotent deduplication.
 */
export async function accrueCreatorLedgerEntryCAS(
  db: D1Database,
  entry: AccrueLedgerInput,
  maxRetries = 8,
  nowMs = Date.now(),
): Promise<AccrueLedgerResult> {
  const eventType = entry.eventType ?? 'royalty_accrual';
  const sourceType = entry.sourceType ?? 'blueprint_remix';

  const probe = () =>
    probeExistingLedger(db, entry.creatorId, entry.referenceId, eventType, sourceType, entry.amountCents);

  // 1. Initial deduplication probe (fast path for sequential idempotency)
  const initial = await probe();
  if (initial) return initial;

  // 2. CAS optimistic insertion loop
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const retryExisting = await probe();
      if (retryExisting) return retryExisting;
    }

    const result = await attemptCasInsert(db, entry, attempt, maxRetries, nowMs, probe);
    if (result) return result;
  }

  // Final safety net probe before returning error
  const finalExisting = await probe();
  if (finalExisting) return finalExisting;

  return {
    success: false,
    ledgerId: '',
    newBalanceCents: 0,
    sequenceNum: 0,
    error: 'CAS_CONCURRENCY_EXHAUSTED',
  };
}

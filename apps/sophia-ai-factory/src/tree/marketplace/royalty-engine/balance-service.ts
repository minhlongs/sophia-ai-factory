/**
 * @file balance-service.ts
 * @description Balance inspection and snapshot retrieval from creator earnings ledger.
 * @layer tree
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { CreatorBalanceSummary } from '../types';

/**
 * Retrieves creator balance and sequence ledger state.
 */
export async function getCreatorBalance(
  db: D1Database | null,
  creatorId: string,
): Promise<CreatorBalanceSummary> {
  let totalEarnedCents = 0;
  let totalWithdrawnCents = 0;
  let availableBalanceCents = 0;
  let lastSequenceNum = 0;

  if (!db) {
    return {
      creatorId,
      totalEarnedCents: 0,
      totalWithdrawnCents: 0,
      availableBalanceCents: 0,
      lastSequenceNum: 0,
    };
  }

  try {
    // 1. Fetch latest ledger row for fast balance snapshot and sequence
    const tailRow = await db
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

    if (tailRow) {
      lastSequenceNum = tailRow.sequence_num ?? 0;
      availableBalanceCents = Math.max(0, tailRow.balance_after_cents ?? 0);
    }

    // 2. Fetch totals for earned and withdrawn
    const aggregate = await db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN amount_cents > 0 THEN amount_cents ELSE 0 END), 0) AS total_earned,
           COALESCE(SUM(CASE WHEN amount_cents < 0 THEN ABS(amount_cents) ELSE 0 END), 0) AS total_withdrawn
         FROM creator_earnings_ledger
         WHERE creator_id = ?`,
      )
      .bind(creatorId)
      .first<{ total_earned?: number; total_withdrawn?: number }>();

    if (aggregate) {
      totalEarnedCents = aggregate.total_earned ?? 0;
      totalWithdrawnCents = aggregate.total_withdrawn ?? 0;
    }
  } catch (err) {
    logger.warn('[royalty-engine] Could not query creator_earnings_ledger, defaulting to 0', {
      creatorId,
      error: String(err),
    });
  }

  return {
    creatorId,
    totalEarnedCents,
    totalWithdrawnCents,
    availableBalanceCents,
    lastSequenceNum,
  };
}

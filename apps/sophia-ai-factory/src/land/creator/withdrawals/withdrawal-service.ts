/**
 * Creator Withdrawal Submission Service (Atomic OCC)
 *
 * Layer: land/creator/withdrawals
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  WithdrawalRequest,
  CreateWithdrawalInput,
} from '@/seed/types/creator-marketplace';
import { CreateWithdrawalInputSchema } from '@/seed/types/creator-marketplace';
import { DEFAULT_MIN_PAYOUT_CENTS } from '@/land/payouts/dual-rail-payout-engine';
import {
  queryUnencumberedCreatorBalance,
  insertCreatorWithdrawalRow,
} from './withdrawal-balance-check';

/**
 * Submit a new withdrawal request with dual-rail validation and OCC CAS reservation.
 */
export async function createCreatorWithdrawalRequest(
  db: D1Database,
  creatorId: string,
  rawInput: CreateWithdrawalInput,
  nowMs = Date.now(),
): Promise<{ success: boolean; request?: WithdrawalRequest; error?: string }> {
  const parseResult = CreateWithdrawalInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join('; '),
    };
  }

  const input = parseResult.data;

  if (input.amountCents < DEFAULT_MIN_PAYOUT_CENTS) {
    return {
      success: false,
      error: `Minimum withdrawal amount is $${(DEFAULT_MIN_PAYOUT_CENTS / 100).toFixed(2)} (5,000 cents)`,
    };
  }

  const MAX_OCC_RETRIES = 3;
  let attempts = 0;

  while (attempts < MAX_OCC_RETRIES) {
    attempts++;

    const { unencumberedCents, currentUpdatedAt } = await queryUnencumberedCreatorBalance(db, creatorId);

    if (input.amountCents > unencumberedCents) {
      return {
        success: false,
        error: `INSUFFICIENT_UNENCUMBERED_BALANCE: Requested $${(input.amountCents / 100).toFixed(2)}, available unencumbered $${(unencumberedCents / 100).toFixed(2)}`,
      };
    }

    const casResult = await db
      .prepare(
        `UPDATE creator_profiles
         SET updated_at = ?
         WHERE (id = ? OR user_id = ?) AND updated_at = ?`,
      )
      .bind(nowMs + attempts, creatorId, creatorId, currentUpdatedAt)
      .run();

    const casChanges = casResult.meta?.changes ?? 0;
    if (casChanges === 0) {
      if (attempts < MAX_OCC_RETRIES) {
        await new Promise((r) => setTimeout(r, 10 * attempts));
        continue;
      }
      return {
        success: false,
        error: 'CONCURRENCY_CONFLICT: Balance was concurrently modified. Please retry.',
      };
    }

    try {
      const request = await insertCreatorWithdrawalRow(db, creatorId, input, nowMs);

      logger.info('Creator withdrawal request submitted', {
        withdrawalId: request.id,
        creatorId,
        rail: input.rail,
        amountCents: input.amountCents,
      });

      return { success: true, request };
    } catch (err) {
      logger.error('Failed to insert creator withdrawal request', { creatorId, error: String(err) });
      return { success: false, error: err instanceof Error ? err.message : 'INSERT_FAILED' };
    }
  }

  return { success: false, error: 'CONCURRENCY_EXHAUSTED' };
}

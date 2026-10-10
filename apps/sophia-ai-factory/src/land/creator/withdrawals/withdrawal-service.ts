/**
 * Creator Withdrawal Submission Service (Atomic OCC)
 *
 * Layer: land/creator/withdrawals
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  WithdrawalRequest,
  CreateWithdrawalInput,
  WithdrawalStatus,
} from '@/seed/types/creator-marketplace';
import { CreateWithdrawalInputSchema } from '@/seed/types/creator-marketplace';
import { DEFAULT_MIN_PAYOUT_CENTS } from '@/land/payouts/dual-rail-payout-engine';

/**
 * Submit a new withdrawal request with dual-rail validation and OCC CAS reservation.
 */
export async function createCreatorWithdrawalRequest(
  db: D1Database,
  creatorId: string,
  rawInput: CreateWithdrawalInput,
  nowMs = Date.now(),
): Promise<{ success: boolean; request?: WithdrawalRequest; error?: string }> {
  // 1. Zod input validation
  const parseResult = CreateWithdrawalInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues.map((e) => e.message).join('; '),
    };
  }

  const input = parseResult.data;

  // 2. Minimum payout threshold check ($50 = 5,000 cents)
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

    // 3. Unencumbered balance check with OCC version snapshot
    let currentUpdatedAt = 0;
    let availableCents = 0;
    try {
      const profile = await db
        .prepare(
          `SELECT total_earnings_cents, total_paid_cents, updated_at
           FROM creator_profiles
           WHERE id = ? OR user_id = ?
           LIMIT 1`,
        )
        .bind(creatorId, creatorId)
        .first<{ total_earnings_cents?: number; total_paid_cents?: number; updated_at?: number }>();

      if (profile) {
        availableCents = Math.max(0, (profile.total_earnings_cents ?? 0) - (profile.total_paid_cents ?? 0));
        currentUpdatedAt = profile.updated_at ?? 0;
      }
    } catch (err) {
      logger.warn('Failed to query creator profile for balance calculation', { creatorId, error: String(err) });
    }

    let lockedCents = 0;
    try {
      const pendingWithdrawals = await db
        .prepare(
          `SELECT COALESCE(SUM(amount_cents), 0) as locked_cents
           FROM creator_withdrawal_requests
           WHERE creator_id = ? AND status IN ('pending', 'processing')`,
        )
        .bind(creatorId)
        .first<{ locked_cents?: number }>();

      if (pendingWithdrawals) {
        lockedCents = pendingWithdrawals.locked_cents ?? 0;
      }
    } catch (err) {
      logger.warn('Failed to query pending withdrawals for locked balance', { creatorId, error: String(err) });
    }

    const unencumberedCents = Math.max(0, availableCents - lockedCents);
    if (input.amountCents > unencumberedCents) {
      return {
        success: false,
        error: `INSUFFICIENT_UNENCUMBERED_BALANCE: Requested $${(input.amountCents / 100).toFixed(2)}, available unencumbered $${(unencumberedCents / 100).toFixed(2)}`,
      };
    }

    // 4. Atomic OCC CAS reservation on creator profile state
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
      // Concurrent update collision — back off and retry against refreshed state
      if (attempts < MAX_OCC_RETRIES) {
        await new Promise((r) => setTimeout(r, 10 * attempts));
        continue;
      }
      return {
        success: false,
        error: 'CONCURRENCY_CONFLICT: Balance was concurrently modified. Please retry.',
      };
    }

    // 5. Insert withdrawal request
    const id = `with_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const status: WithdrawalStatus = 'pending';

    try {
      await db
        .prepare(
          `INSERT INTO creator_withdrawal_requests (
            id, creator_id, amount_cents, currency, rail,
            destination_address, bank_bin, bank_account_number, bank_account_name,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          id,
          creatorId,
          input.amountCents,
          'USD',
          input.rail,
          input.destinationAddress ?? null,
          input.bankBin ?? null,
          input.bankAccountNumber ?? null,
          input.bankAccountName ?? null,
          status,
          nowMs,
          nowMs,
        )
        .run();

      const request: WithdrawalRequest = {
        id,
        creatorId,
        amountCents: input.amountCents,
        currency: 'USD',
        rail: input.rail,
        destinationAddress: input.destinationAddress ?? null,
        bankBin: input.bankBin ?? null,
        bankAccountNumber: input.bankAccountNumber ?? null,
        bankAccountName: input.bankAccountName ?? null,
        status,
        txHash: null,
        adminNotes: null,
        createdAt: nowMs,
        updatedAt: nowMs,
      };

      logger.info('Creator withdrawal request submitted', {
        withdrawalId: id,
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

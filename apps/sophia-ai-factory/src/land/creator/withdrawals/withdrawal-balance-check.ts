/**
 * Creator Withdrawal Unencumbered Balance & OCC CAS Reservation Helper
 *
 * Layer: land/creator/withdrawals
 * @module land/creator/withdrawals/withdrawal-balance-check
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  WithdrawalRequest,
  CreateWithdrawalInput,
  WithdrawalStatus,
} from '@/seed/types/creator-marketplace';

export async function queryUnencumberedCreatorBalance(
  db: D1Database,
  creatorId: string,
): Promise<{ unencumberedCents: number; currentUpdatedAt: number }> {
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

  return {
    unencumberedCents: Math.max(0, availableCents - lockedCents),
    currentUpdatedAt,
  };
}

export async function insertCreatorWithdrawalRow(
  db: D1Database,
  creatorId: string,
  input: CreateWithdrawalInput,
  nowMs: number,
): Promise<WithdrawalRequest> {
  const id = `with_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const status: WithdrawalStatus = 'pending';

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

  return {
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
}

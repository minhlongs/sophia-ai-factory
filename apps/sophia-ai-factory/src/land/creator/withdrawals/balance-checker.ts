/**
 * Creator Unencumbered Balance Calculator
 *
 * Layer: land/creator/withdrawals
 */

import { logger } from '@/seed/utils/logger-utility';

/**
 * Calculate available and unencumbered creator balance in cents.
 */
export async function getCreatorUnencumberedBalance(
  db: D1Database,
  creatorId: string,
): Promise<{ availableCents: number; lockedCents: number; unencumberedCents: number }> {
  let totalEarningsCents = 0;
  let totalPaidCents = 0;
  let lockedCents = 0;

  try {
    const profile = await db
      .prepare(
        `SELECT total_earnings_cents, total_paid_cents
         FROM creator_profiles
         WHERE id = ? OR user_id = ?
         LIMIT 1`,
      )
      .bind(creatorId, creatorId)
      .first<{ total_earnings_cents?: number; total_paid_cents?: number }>();

    if (profile) {
      totalEarningsCents = profile.total_earnings_cents ?? 0;
      totalPaidCents = profile.total_paid_cents ?? 0;
    }
  } catch (err) {
    logger.warn('Failed to query creator profile for balance calculation', {
      creatorId,
      error: String(err),
    });
  }

  const availableCents = Math.max(0, totalEarningsCents - totalPaidCents);

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
    logger.warn('Failed to query pending withdrawals for locked balance', {
      creatorId,
      error: String(err),
    });
  }

  const unencumberedCents = Math.max(0, availableCents - lockedCents);

  return {
    availableCents,
    lockedCents,
    unencumberedCents,
  };
}

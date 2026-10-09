/**
 * Creator Profile & Payout Settings operations for Creator Studio
 *
 * @module land/creator/studio/profile-manager
 */

import { logger } from '@/seed/utils/logger-utility';
import type { PayoutRail } from '@/seed/types/creator-marketplace';
import type { CreatorProfileData } from './types';

/**
 * Fetch creator profile details including payout rail and banking configuration.
 */
export async function getCreatorProfile(
  db: D1Database,
  creatorIdOrUserId: string,
): Promise<CreatorProfileData | null> {
  try {
    const row = await db
      .prepare(
        `SELECT id, user_id, display_name, payout_rail, payout_address,
                bank_bin, bank_account_number, bank_account_name,
                total_earnings_cents, total_paid_cents, status
         FROM creator_profiles
         WHERE id = ? OR user_id = ?
         LIMIT 1`,
      )
      .bind(creatorIdOrUserId, creatorIdOrUserId)
      .first<{
        id: string;
        user_id: string;
        display_name: string;
        payout_rail?: string | null;
        payout_address?: string | null;
        bank_bin?: string | null;
        bank_account_number?: string | null;
        bank_account_name?: string | null;
        total_earnings_cents?: number;
        total_paid_cents?: number;
        status: string;
      }>();

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      payoutRail: (row.payout_rail as PayoutRail) ?? 'USDT',
      payoutAddress: row.payout_address,
      bankBin: row.bank_bin,
      bankAccountNumber: row.bank_account_number,
      bankAccountName: row.bank_account_name,
      totalEarningsCents: row.total_earnings_cents ?? 0,
      totalPaidCents: row.total_paid_cents ?? 0,
      status: row.status,
    };
  } catch (err) {
    logger.warn('Failed to fetch creator profile', { identifier: creatorIdOrUserId, error: String(err) });
    return null;
  }
}

/**
 * Update payout preferences (USDT or VietQR) on creator_profiles.
 */
export async function updateCreatorPayoutSettings(
  db: D1Database,
  creatorId: string,
  config: {
    payoutRail: PayoutRail;
    payoutAddress?: string;
    bankBin?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  },
  nowMs = Date.now(),
): Promise<{ success: boolean; error?: string }> {
  try {
    await db
      .prepare(
        `UPDATE creator_profiles
         SET payout_rail = ?,
             payout_address = ?,
             bank_bin = ?,
             bank_account_number = ?,
             bank_account_name = ?,
             updated_at = ?
         WHERE id = ? OR user_id = ?`,
      )
      .bind(
        config.payoutRail,
        config.payoutAddress ?? null,
        config.bankBin ?? null,
        config.bankAccountNumber ?? null,
        config.bankAccountName ?? null,
        nowMs,
        creatorId,
        creatorId,
      )
      .run();

    return { success: true };
  } catch (err) {
    logger.error('Failed to update creator payout settings', { creatorId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : 'UPDATE_FAILED' };
  }
}

/**
 * Creator Payout Dispatcher Helpers (VietQR Info & Withdrawal History)
 *
 * Layer: land/creator/withdrawals
 * @module land/creator/withdrawals/payout-dispatcher-helpers
 */

import { logger } from '@/seed/utils/logger-utility';
import type { WithdrawalRequest } from '@/seed/types/creator-marketplace';
import {
  buildVietQrPaymentUrl,
  getExchangeRateVnd,
} from '@/land/payouts/dual-rail-payout-engine';
import { mapWithdrawalRow, type WithdrawalDbRow } from './types';

/**
 * Generate instant VietQR payment info and QR link for domestic Vietnamese transfers.
 */
export function getVietQrPaymentInfo(
  request: WithdrawalRequest,
  customExchangeRate?: number,
): { qrUrl: string; amountVnd: number; amountUsd: number } | null {
  if (request.rail !== 'VIETQR' || !request.bankBin || !request.bankAccountNumber) {
    return null;
  }

  const rate = customExchangeRate && customExchangeRate > 0
    ? customExchangeRate
    : getExchangeRateVnd();

  const amountUsd = request.amountCents / 100;
  const amountVnd = Math.round(amountUsd * rate);
  const memo = `SOPHIA CREATOR ${request.id.slice(-8).toUpperCase()}`;
  const accountName = request.bankAccountName || 'CREATOR';

  const qrUrl = buildVietQrPaymentUrl(
    request.bankBin,
    request.bankAccountNumber,
    amountVnd,
    memo,
    accountName,
  );

  return {
    qrUrl,
    amountVnd,
    amountUsd,
  };
}

/**
 * List withdrawal history for a creator.
 */
export async function listCreatorWithdrawals(
  db: D1Database,
  creatorId: string,
  options?: { limit?: number; offset?: number },
): Promise<{ items: WithdrawalRequest[]; total: number }> {
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
  const offset = Math.max(options?.offset ?? 0, 0);

  let total = 0;
  try {
    const countRow = await db
      .prepare(`SELECT COUNT(*) as cnt FROM creator_withdrawal_requests WHERE creator_id = ?`)
      .bind(creatorId)
      .first<{ cnt?: number }>();
    total = countRow?.cnt ?? 0;
  } catch (err) {
    logger.warn('Failed to count creator withdrawals', { creatorId, error: String(err) });
  }

  try {
    const rows = await db
      .prepare(
        `SELECT * FROM creator_withdrawal_requests
         WHERE creator_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .bind(creatorId, limit, offset)
      .all<WithdrawalDbRow>();

    const items = (rows.results ?? []).map(mapWithdrawalRow);
    return { items, total };
  } catch (err) {
    logger.error('Failed to list creator withdrawals', { creatorId, error: String(err) });
    return { items: [], total: 0 };
  }
}

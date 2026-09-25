/**
 * Creator Dual-Rail Withdrawal Service
 *
 * Layer: land (user-facing operations, D1 database mutations, and external payment bridge)
 * Dependencies: @/seed/types/creator-marketplace, @/seed/utils/logger-utility, @/land/payouts/dual-rail-payout-engine
 *
 * Coordinates creator royalty disbursements across two rails:
 * 1. Global / Web3 Rail: USDT (TRC-20 / ERC-20)
 * 2. Vietnam Domestic Rail: VietQR (NAPAS 247 banking instant transfers with live VND conversion)
 *
 * Invariants:
 * - Enforces minimum withdrawal threshold of $50.00 (5,000 cents)
 * - Verifies unencumbered balance (available balance minus currently pending/processing withdrawals)
 * - Atomic state progression and ledger tracking
 *
 * @module land/creator/creator-withdrawal-service
 */

import { logger } from '@/seed/utils/logger-utility';
import type {
  WithdrawalRequest,
  CreateWithdrawalInput,
  WithdrawalStatus,
  PayoutRail,
} from '@/seed/types/creator-marketplace';
import { CreateWithdrawalInputSchema } from '@/seed/types/creator-marketplace';
import {
  DEFAULT_USD_TO_VND_RATE,
  DEFAULT_MIN_PAYOUT_CENTS,
  buildVietQrPaymentUrl,
  getExchangeRateVnd,
} from '@/land/payouts/dual-rail-payout-engine';

interface WithdrawalDbRow {
  id: string;
  creator_id: string;
  amount_cents: number;
  currency: string;
  rail: string;
  destination_address: string | null;
  bank_bin: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  status: string;
  tx_hash: string | null;
  admin_notes: string | null;
  created_at: number;
  updated_at: number;
}

function mapWithdrawalRow(row: WithdrawalDbRow): WithdrawalRequest {
  return {
    id: row.id,
    creatorId: row.creator_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    rail: row.rail as PayoutRail,
    destinationAddress: row.destination_address,
    bankBin: row.bank_bin,
    bankAccountNumber: row.bank_account_number,
    bankAccountName: row.bank_account_name,
    status: row.status as WithdrawalStatus,
    txHash: row.tx_hash,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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
    logger.warn('Failed to query creator profile for balance calculation', { creatorId, error: String(err) });
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
    logger.warn('Failed to query pending withdrawals for locked balance', { creatorId, error: String(err) });
  }

  const unencumberedCents = Math.max(0, availableCents - lockedCents);

  return {
    availableCents,
    lockedCents,
    unencumberedCents,
  };
}

/**
 * Submit a new withdrawal request with dual-rail validation.
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

  // 3. Unencumbered balance check
  const balances = await getCreatorUnencumberedBalance(db, creatorId);
  if (input.amountCents > balances.unencumberedCents) {
    return {
      success: false,
      error: `INSUFFICIENT_UNENCUMBERED_BALANCE: Requested $${(input.amountCents / 100).toFixed(2)}, available unencumbered $${(balances.unencumberedCents / 100).toFixed(2)}`,
    };
  }

  // 4. Insert withdrawal request
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
 * Process a withdrawal request (admin / automated completion or rejection).
 */
export async function processWithdrawalRequest(
  db: D1Database,
  withdrawalId: string,
  action: 'complete' | 'reject',
  notes?: string,
  txHash?: string,
  nowMs = Date.now(),
): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await db
      .prepare(`SELECT * FROM creator_withdrawal_requests WHERE id = ? LIMIT 1`)
      .bind(withdrawalId)
      .first<WithdrawalDbRow>();

    if (!current) {
      return { success: false, error: 'WITHDRAWAL_NOT_FOUND' };
    }

    if (current.status !== 'pending' && current.status !== 'processing') {
      return { success: false, error: `INVALID_STATUS_TRANSITION: Current status is ${current.status}` };
    }

    const nextStatus: WithdrawalStatus = action === 'complete' ? 'completed' : 'rejected';

    await db
      .prepare(
        `UPDATE creator_withdrawal_requests 
         SET status = ?, tx_hash = ?, admin_notes = ?, updated_at = ? 
         WHERE id = ?`,
      )
      .bind(nextStatus, txHash ?? current.tx_hash, notes ?? current.admin_notes, nowMs, withdrawalId)
      .run();

    if (action === 'complete') {
      // Update creator profile total_paid_cents
      await db
        .prepare(
          `UPDATE creator_profiles 
           SET total_paid_cents = total_paid_cents + ?, updated_at = ? 
           WHERE id = ? OR user_id = ?`,
        )
        .bind(current.amount_cents, nowMs, current.creator_id, current.creator_id)
        .run();

      // Record in creator_earnings_ledger as royalty_payout
      try {
        const ledgerId = `led_payout_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}_${nowMs}`;
        await db
          .prepare(
            `INSERT INTO creator_earnings_ledger (
              id, creator_id, amount_cents, currency, event_type, source_type,
              reference_id, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            ledgerId,
            current.creator_id,
            -current.amount_cents,
            current.currency,
            'royalty_payout',
            'withdrawal_request',
            withdrawalId,
            'paid',
            nowMs,
          )
          .run();
      } catch (ledgerErr) {
        logger.warn('Failed to insert payout event in creator_earnings_ledger', { withdrawalId, error: String(ledgerErr) });
      }
    }

    logger.info('Creator withdrawal status transitioned', {
      withdrawalId,
      oldStatus: current.status,
      newStatus: nextStatus,
    });

    return { success: true };
  } catch (err) {
    logger.error('Failed to process creator withdrawal request', { withdrawalId, error: String(err) });
    return { success: false, error: err instanceof Error ? err.message : 'PROCESS_FAILED' };
  }
}

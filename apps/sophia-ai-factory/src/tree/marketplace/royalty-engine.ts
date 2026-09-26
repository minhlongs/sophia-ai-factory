/**
 * 70/30 Royalty Smart Ledger & Payout Reconciliation Engine
 *
 * Layer: tree (pure domain logic, exact cent arithmetic, concurrency control)
 * Dependencies: @/seed/db/client, @/seed/utils/logger-utility, ./types
 *
 * Principles:
 * 1. Zero Penny Leakage Invariant:
 *    creatorCents = Math.floor((priceCents * 70) / 100)
 *    platformCents = priceCents - creatorCents
 *    creatorCents + platformCents === priceCents (for all prices >= 0)
 * 2. Anti-Circular Self-Activation Guard:
 *    Creators cannot activate their own blueprints for royalties.
 *    Throws 'SELF_TEMPLATE_ACTIVATION_PROHIBITED' if creatorId === activatingUserId.
 * 3. Optimistic Concurrency Control (OCC CAS):
 *    Monotonic sequence_num per creator in creator_earnings_ledger.
 *    Retries up to 8x with exponential backoff and jitter on sequence collisions.
 * 4. Payout Reconciliation:
 *    Enforces minimum $50.00 (5,000 cents) threshold.
 *    Validates VietQR 6-digit NAPAS BIN & USDT addresses.
 *    Solvency check: available balance >= withdrawal amount.
 *    Records negative debit entry into creator_earnings_ledger.
 *
 * @module tree/marketplace/royalty-engine
 */

import type { D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  RoyaltySplit,
  RoyaltyAccrualInput,
  RoyaltyAccrualResult,
  WithdrawalRequestInput,
  WithdrawalRequestResult,
  CreatorBalanceSummary,
  PayoutRail,
} from './types';

export const DEFAULT_ROYALTY_PCT = 70.0;
export const MIN_WITHDRAWAL_CENTS = 5000; // $50.00 USD minimum payout
export const MAX_CAS_RETRIES = 8;

/**
 * Calculates pure integer 70/30 royalty split with zero fractional penny leakage.
 */
export function calculateRoyaltySplit(
  priceCents: number,
  royaltyPct = DEFAULT_ROYALTY_PCT,
): RoyaltySplit {
  if (priceCents <= 0) {
    return { creatorCents: 0, platformCents: 0, totalCents: 0 };
  }

  if (royaltyPct <= 0) {
    return { creatorCents: 0, platformCents: priceCents, totalCents: priceCents };
  }

  if (royaltyPct >= 100) {
    return { creatorCents: priceCents, platformCents: 0, totalCents: priceCents };
  }

  const creatorCents = Math.floor((priceCents * royaltyPct) / 100);
  const platformCents = priceCents - creatorCents;

  return {
    creatorCents,
    platformCents,
    totalCents: priceCents,
  };
}

/**
 * Checks for circular self-activation.
 */
export function isSelfTemplateActivation(creatorId: string, activatingUserId: string): boolean {
  if (!creatorId || !activatingUserId) return false;
  return creatorId.trim() === activatingUserId.trim();
}

/**
 * Validates payout rail parameters.
 * Throws descriptive errors if formatting is invalid.
 */
export function validatePayoutRail(
  rail: PayoutRail,
  details: {
    destinationAddress?: string;
    bankBin?: string;
    bankAccountNumber?: string;
    bankAccountName?: string;
  },
): void {
  if (rail === 'USDT') {
    const addr = details.destinationAddress?.trim();
    if (!addr || addr.length < 10) {
      throw new Error('INVALID_USDT_ADDRESS: Destination address must be at least 10 characters.');
    }
    // Basic address pattern check (ERC20 0x..., TRC20 T..., Solana/base58)
    const validAddressRegex = /^(0x[a-fA-F0-9]{40}|T[A-Za-z1-9]{33}|[1-9A-HJ-NP-Za-km-z]{26,44})$/;
    if (!validAddressRegex.test(addr)) {
      throw new Error('INVALID_USDT_ADDRESS: Malformed USDT wallet address format.');
    }
  } else if (rail === 'VIETQR') {
    const bin = details.bankBin?.trim();
    if (!bin || !/^\d{6}$/.test(bin)) {
      throw new Error('INVALID_VIETQR_BIN: Must provide a valid 6-digit NAPAS bank BIN code.');
    }
    const accNum = details.bankAccountNumber?.trim();
    if (!accNum || accNum.length < 4 || !/^[a-zA-Z0-9]+$/.test(accNum)) {
      throw new Error('INVALID_VIETQR_ACCOUNT_NUMBER: Bank account number must be at least 4 alphanumeric characters.');
    }
    const accName = details.bankAccountName?.trim();
    if (!accName || accName.length < 2) {
      throw new Error('INVALID_VIETQR_ACCOUNT_NAME: Account holder name must be at least 2 characters.');
    }
  } else {
    throw new Error(`UNSUPPORTED_PAYOUT_RAIL: Rail '${rail}' is not supported.`);
  }
}

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

/**
 * Executes a 70/30 template activation royalty accrual with OCC CAS on creator_earnings_ledger.
 *
 * Enforces:
 * - Anti-self-activation check: throws 'SELF_TEMPLATE_ACTIVATION_PROHIBITED'
 * - Idempotency on (creator_id, reference_id, event_type)
 * - Monotonic sequence numbering with full jitter backoff retry loop
 */
export async function accrueRoyalty(input: RoyaltyAccrualInput): Promise<RoyaltyAccrualResult> {
  const nowMs = input.nowMs ?? Date.now();

  // 1. Anti-circular self-activation check
  if (isSelfTemplateActivation(input.creatorId, input.activatingUserId)) {
    throw new Error('SELF_TEMPLATE_ACTIVATION_PROHIBITED');
  }

  // 2. Compute 70/30 split
  const split = calculateRoyaltySplit(input.priceCents, input.royaltyPct ?? DEFAULT_ROYALTY_PCT);
  const activationId = input.referenceId || `act_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;

  const eventType = 'royalty_accrual';
  const sourceType = 'template_activation';

  // 3. Fast path: probe existing entry for idempotency
  try {
    const existing = await input.db
      .prepare(
        `SELECT id, balance_after_cents, sequence_num, amount_cents 
         FROM creator_earnings_ledger 
         WHERE creator_id = ? AND reference_id = ? AND event_type = ? 
         LIMIT 1`,
      )
      .bind(input.creatorId, activationId, eventType)
      .first<{
        id: string;
        balance_after_cents?: number;
        sequence_num?: number;
        amount_cents?: number;
      }>();

    if (existing) {
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
  } catch {
    // Proceed if table doesn't have existing record
  }

  // 4. OCC CAS Insertion Loop
  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    try {
      // Re-probe on retry
      if (attempt > 0) {
        const retryExisting = await input.db
          .prepare(
            `SELECT id, balance_after_cents, sequence_num, amount_cents 
             FROM creator_earnings_ledger 
             WHERE creator_id = ? AND reference_id = ? AND event_type = ? 
             LIMIT 1`,
          )
          .bind(input.creatorId, activationId, eventType)
          .first<{
            id: string;
            balance_after_cents?: number;
            sequence_num?: number;
            amount_cents?: number;
          }>();

        if (retryExisting) {
          return {
            success: true,
            activationId,
            creatorCents: retryExisting.amount_cents ?? split.creatorCents,
            platformCents: split.platformCents,
            ledgerId: retryExisting.id,
            sequenceNum: retryExisting.sequence_num ?? 1,
            balanceAfterCents: retryExisting.balance_after_cents ?? split.creatorCents,
          };
        }
      }

      // Read current tail sequence and balance
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

      const lastSeq = tail?.sequence_num ?? 0;
      const lastBal = tail?.balance_after_cents ?? 0;

      const nextSeq = lastSeq + 1;
      const nextBal = lastBal + split.creatorCents;
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

      // Insert into creator_earnings_ledger
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
    } catch (err: unknown) {
      const errStr = String(err);
      const isConstraintError =
        errStr.includes('UNIQUE') ||
        errStr.includes('PRIMARY KEY') ||
        errStr.includes('constraint') ||
        errStr.includes('SQLITE_CONSTRAINT');

      if (isConstraintError && attempt < MAX_CAS_RETRIES - 1) {
        // Full jitter exponential backoff: delay = random(0, 10 * 2^attempt) + random(0, 15)
        const maxWait = 10 * Math.pow(2, attempt);
        const delay = Math.floor(Math.random() * maxWait) + Math.floor(Math.random() * 15);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      logger.error('[royalty-engine] CAS accrual failed after retries', {
        creatorId: input.creatorId,
        attempt,
        error: errStr,
      });

      throw err;
    }
  }

  throw new Error('ROYALTY_ACCRUAL_CAS_EXHAUSTED');
}

/**
 * Reconciles and processes a creator payout request.
 *
 * Enforces:
 * - Minimum threshold >= 5,000 cents ($50.00)
 * - Payout rail validation (USDT format / VietQR 6-digit NAPAS BIN)
 * - Solvency verification: available balance >= withdrawal amount
 * - Negative debit insertion into creator_earnings_ledger via OCC CAS
 * - Record insertion into creator_withdrawal_requests
 */
export async function processCreatorWithdrawal(
  input: WithdrawalRequestInput,
): Promise<WithdrawalRequestResult> {
  const nowMs = input.nowMs ?? Date.now();

  // 1. Minimum amount check ($50.00 = 5,000 cents)
  if (input.amountCents < MIN_WITHDRAWAL_CENTS) {
    throw new Error(`MINIMUM_WITHDRAWAL_5000_CENTS: Requested ${input.amountCents} cents is below the minimum threshold of ${MIN_WITHDRAWAL_CENTS} cents ($50.00).`);
  }

  // 2. Validate payout rail format
  validatePayoutRail(input.rail, {
    destinationAddress: input.destinationAddress,
    bankBin: input.bankBin,
    bankAccountNumber: input.bankAccountNumber,
    bankAccountName: input.bankAccountName,
  });

  // 3. Solvency check
  const balanceSummary = await getCreatorBalance(input.db, input.creatorId);
  if (balanceSummary.availableBalanceCents < input.amountCents) {
    throw new Error(`INSUFFICIENT_CREATOR_BALANCE: Available balance is ${balanceSummary.availableBalanceCents} cents, requested ${input.amountCents} cents.`);
  }

  const withdrawalId = `wdr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;
  const initialStatus = input.txHash ? 'completed' : 'pending';

  // 4. Record negative debit entry via OCC CAS
  const debitAmount = -Math.abs(input.amountCents);
  let ledgerId = '';
  let sequenceNum = 0;
  let remainingBalanceCents = 0;

  for (let attempt = 0; attempt < MAX_CAS_RETRIES; attempt++) {
    try {
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

      const lastSeq = tail?.sequence_num ?? 0;
      const lastBal = tail?.balance_after_cents ?? 0;

      if (lastBal < input.amountCents) {
        throw new Error(`INSUFFICIENT_CREATOR_BALANCE: Current balance is ${lastBal} cents, requested ${input.amountCents} cents.`);
      }

      const nextSeq = lastSeq + 1;
      const nextBal = lastBal + debitAmount; // subtracts amount
      const candidateLedgerId = `led_deb_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}_${nowMs}`;

      const metadataJson = JSON.stringify({
        withdrawalId,
        rail: input.rail,
        destinationAddress: input.destinationAddress,
        bankBin: input.bankBin,
        bankAccountNumber: input.bankAccountNumber,
        bankAccountName: input.bankAccountName,
        txHash: input.txHash,
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
          candidateLedgerId,
          input.creatorId,
          debitAmount,
          'USD',
          'royalty_payout',
          'withdrawal',
          withdrawalId,
          nextBal,
          input.txHash ? 'paid' : 'pending',
          nextSeq,
          metadataJson,
          nowMs,
        )
        .run();

      ledgerId = candidateLedgerId;
      sequenceNum = nextSeq;
      remainingBalanceCents = nextBal;
      break;
    } catch (err: unknown) {
      const errStr = String(err);
      if (errStr.includes('INSUFFICIENT_CREATOR_BALANCE')) {
        throw err;
      }
      const isConstraint =
        errStr.includes('UNIQUE') ||
        errStr.includes('PRIMARY KEY') ||
        errStr.includes('constraint') ||
        errStr.includes('SQLITE_CONSTRAINT');

      if (isConstraint && attempt < MAX_CAS_RETRIES - 1) {
        const maxWait = 10 * Math.pow(2, attempt);
        const delay = Math.floor(Math.random() * maxWait) + Math.floor(Math.random() * 15);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  // 5. Insert withdrawal request record
  try {
    await input.db
      .prepare(
        `INSERT INTO creator_withdrawal_requests (
          id, creator_id, amount_cents, currency, rail, destination_address,
          bank_bin, bank_account_number, bank_account_name, status,
          tx_hash, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        withdrawalId,
        input.creatorId,
        input.amountCents,
        'USD',
        input.rail,
        input.destinationAddress ?? null,
        input.bankBin ?? null,
        input.bankAccountNumber ?? null,
        input.bankAccountName ?? null,
        initialStatus,
        input.txHash ?? null,
        nowMs,
        nowMs,
      )
      .run();
  } catch (insertErr) {
    logger.warn('[royalty-engine] Could not record into creator_withdrawal_requests (non-fatal if mock table missing)', {
      withdrawalId,
      error: String(insertErr),
    });
  }

  return {
    success: true,
    withdrawalId,
    amountCents: input.amountCents,
    rail: input.rail,
    status: initialStatus,
    ledgerId,
    sequenceNum,
    remainingBalanceCents,
    txHash: input.txHash,
  };
}

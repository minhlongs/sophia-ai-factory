/**
 * @file withdrawal-service.ts
 * @description Payout requests and negative debit balance reconciliation with OCC CAS.
 * @layer tree
 */

import type { WithdrawalRequestInput, WithdrawalRequestResult } from '../types';
import { getCreatorBalance } from './balance-service';
import { MAX_CAS_RETRIES, MIN_WITHDRAWAL_CENTS } from './constants';
import { validatePayoutRail } from './payout-validator';
import {
  buildWithdrawalCasStatements,
  isCasConstraintConflict,
} from './withdrawal-cas-helpers';

async function executeDebitCas(
  input: WithdrawalRequestInput,
  withdrawalId: string,
  debitAmount: number,
  initialStatus: string,
  nowMs: number,
): Promise<{ ledgerId: string; sequenceNum: number; remainingBalanceCents: number }> {
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

      const { ledgerStmt, withdrawalStmt } = buildWithdrawalCasStatements({
        input,
        candidateLedgerId,
        withdrawalId,
        debitAmount,
        nextBal,
        nextSeq,
        initialStatus,
        nowMs,
      });

      if (typeof input.db.batch === 'function') {
        await input.db.batch([ledgerStmt, withdrawalStmt]);
      } else {
        await ledgerStmt.run();
        try {
          await withdrawalStmt.run();
        } catch (withdrawalErr) {
          await input.db
            .prepare(`DELETE FROM creator_earnings_ledger WHERE id = ?`)
            .bind(candidateLedgerId)
            .run()
            .catch(() => {});
          throw withdrawalErr;
        }
      }

      return {
        ledgerId: candidateLedgerId,
        sequenceNum: nextSeq,
        remainingBalanceCents: nextBal,
      };
    } catch (err: unknown) {
      const errStr = String(err);
      if (errStr.includes('INSUFFICIENT_CREATOR_BALANCE')) {
        throw err;
      }

      if (isCasConstraintConflict(errStr) && attempt < MAX_CAS_RETRIES - 1) {
        const maxWait = 10 * Math.pow(2, attempt);
        const delay = Math.floor(Math.random() * maxWait) + Math.floor(Math.random() * 15);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }

  throw new Error(`CAS_EXHAUSTED: Could not execute debit after ${MAX_CAS_RETRIES} attempts`);
}

/**
 * Reconciles and processes a creator payout request.
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
  const { ledgerId, sequenceNum, remainingBalanceCents } = await executeDebitCas(
    input,
    withdrawalId,
    debitAmount,
    initialStatus,
    nowMs,
  );

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

/**
 * @file withdrawal-service.ts
 * @description Payout requests and negative debit balance reconciliation with OCC CAS.
 * @layer tree
 */

import type { WithdrawalRequestInput, WithdrawalRequestResult } from '../types';
import { getCreatorBalance } from './balance-service';
import { MIN_WITHDRAWAL_CENTS } from './constants';
import { validatePayoutRail } from './payout-validator';
import { executeDebitCas } from './withdrawal-debit-cas';

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

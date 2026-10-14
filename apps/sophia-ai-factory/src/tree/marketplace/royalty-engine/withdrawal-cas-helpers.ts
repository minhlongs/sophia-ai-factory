/**
 * Prepared statement builders and retry classification for Creator Withdrawal CAS.
 * @module tree/marketplace/royalty-engine/withdrawal-cas-helpers
 */

import type { WithdrawalRequestInput } from '../types';

export function buildWithdrawalCasStatements(params: {
  input: WithdrawalRequestInput;
  candidateLedgerId: string;
  withdrawalId: string;
  debitAmount: number;
  nextBal: number;
  nextSeq: number;
  initialStatus: string;
  nowMs: number;
}) {
  const {
    input,
    candidateLedgerId,
    withdrawalId,
    debitAmount,
    nextBal,
    nextSeq,
    initialStatus,
    nowMs,
  } = params;

  const metadataJson = JSON.stringify({
    withdrawalId,
    rail: input.rail,
    destinationAddress: input.destinationAddress,
    bankBin: input.bankBin,
    bankAccountNumber: input.bankAccountNumber,
    bankAccountName: input.bankAccountName,
    txHash: input.txHash,
  });

  const ledgerStmt = input.db
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
    );

  const withdrawalStmt = input.db
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
    );

  return { ledgerStmt, withdrawalStmt };
}

export function isCasConstraintConflict(errStr: string): boolean {
  return (
    errStr.includes('UNIQUE') ||
    errStr.includes('PRIMARY KEY') ||
    errStr.includes('constraint') ||
    errStr.includes('SQLITE_CONSTRAINT')
  );
}

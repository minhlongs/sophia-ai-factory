/**
 * @file withdrawal-debit-cas.ts
 * @description OCC CAS loop for creator withdrawal negative debit ledger entries.
 * @layer tree
 */

import type { WithdrawalRequestInput } from '../types';
import { MAX_CAS_RETRIES } from './constants';
import {
  buildWithdrawalCasStatements,
  isCasConstraintConflict,
} from './withdrawal-cas-helpers';

export async function executeDebitCas(
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

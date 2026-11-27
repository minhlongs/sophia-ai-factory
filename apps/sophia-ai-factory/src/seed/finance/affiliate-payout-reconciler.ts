/**
 * Round 40 — Three-Way S2S Affiliate Payout Reconciler & Clawback Guard.
 *
 * Reconciles network S2S postbacks vs internal ledger vs settled bank/USDT
 * payouts using exact integer cents (`bigint`) with zero floating-point drift,
 * flagging missing payouts, over-deductions, and clawback reserves.
 *
 * @module seed/finance/affiliate-payout-reconciler
 */

export interface PayoutReconciliationInput {
  readonly networkReportedCents: bigint;
  readonly ledgerRecordedCents: bigint;
  readonly settledBankCents: bigint;
  readonly clawbackReserveBps: number;
}

export interface PayoutReconciliationReport {
  readonly status: 'reconciled' | 'discrepancy_detected' | 'invalid_input';
  readonly postbackVsLedgerDeltaCents: bigint;
  readonly ledgerVsSettledDeltaCents: bigint;
  readonly recommendedReserveCents: bigint;
  readonly releasableNetCents: bigint;
  readonly findings: readonly string[];
}

export function reconcileAffiliatePayoutThreeWay(
  input: PayoutReconciliationInput,
): PayoutReconciliationReport {
  if (
    input.networkReportedCents < 0n ||
    input.ledgerRecordedCents < 0n ||
    input.settledBankCents < 0n ||
    !Number.isFinite(input.clawbackReserveBps) ||
    input.clawbackReserveBps < 0 ||
    input.clawbackReserveBps > 5000
  ) {
    return {
      status: 'invalid_input',
      postbackVsLedgerDeltaCents: 0n,
      ledgerVsSettledDeltaCents: 0n,
      recommendedReserveCents: 0n,
      releasableNetCents: 0n,
      findings: ['Negative cent amounts or out-of-range clawbackReserveBps (0..5000).'],
    };
  }

  const postbackVsLedgerDeltaCents = input.networkReportedCents - input.ledgerRecordedCents;
  const ledgerVsSettledDeltaCents = input.ledgerRecordedCents - input.settledBankCents;
  const reserveBps = BigInt(Math.round(input.clawbackReserveBps));
  const recommendedReserveCents = (input.settledBankCents * reserveBps + 5000n) / 10_000n;
  const releasableNetCents = input.settledBankCents - recommendedReserveCents;

  const findings: string[] = [];
  if (postbackVsLedgerDeltaCents !== 0n) {
    findings.push(`Postback vs Ledger drift: ${postbackVsLedgerDeltaCents.toString()} cents`);
  }
  if (ledgerVsSettledDeltaCents !== 0n) {
    findings.push(`Ledger vs Settled payout drift: ${ledgerVsSettledDeltaCents.toString()} cents`);
  }

  return {
    status: findings.length === 0 ? 'reconciled' : 'discrepancy_detected',
    postbackVsLedgerDeltaCents,
    ledgerVsSettledDeltaCents,
    recommendedReserveCents,
    releasableNetCents,
    findings,
  };
}

/**
 * Financial Reconciliation Calculations
 *
 * Pure Domain Layer (Tree)
 * Mathematical evaluations for auditing claimed ledger sums against external rail confirmations.
 *
 * @module tree/payouts/reconciliation-math
 */

export const RECONCILIATION_TOLERANCE_CENTS = 100; // $1.00

export interface ReconciliationEvaluation {
  diffCents: number;
  isReconciled: boolean;
  alertRequired: boolean;
}

/**
 * Evaluates financial difference between ledger claimed cents and external confirmation cents.
 *
 * Invariants:
 * - diffCents <= toleranceCents (100 cents / $1.00): isReconciled = true, alertRequired = false
 * - diffCents > toleranceCents (100 cents / $1.00): isReconciled = false, alertRequired = true
 */
export function evaluateReconciliation(
  ledgerClaimedCents: number,
  externalConfirmedCents: number,
  toleranceCents: number = RECONCILIATION_TOLERANCE_CENTS,
): ReconciliationEvaluation {
  const diffCents = Math.abs(ledgerClaimedCents - externalConfirmedCents);
  const isReconciled = diffCents <= toleranceCents;
  const alertRequired = !isReconciled;

  return {
    diffCents,
    isReconciled,
    alertRequired,
  };
}

/**
 * Cohort Retention Cell Calculator
 *
 * Layer: tree/revenue/cohort
 */

import type {
  CohortRetentionCell,
  CreateCohortCellInput,
} from '@/seed/types/unified-revenue';

/**
 * Computes a single cell in the cohort retention matrix.
 *
 * Mathematical Invariants:
 * - GRR % = ((startingMrr - contraction - churned) / startingMrr) * 100 <= 100.0%
 * - NRR % = (endingMrr / startingMrr) * 100
 * - endingMrr = startingMrr + expansion - contraction - churned
 */
export function calculateCohortCell(input: CreateCohortCellInput): CohortRetentionCell {
  const startingCustomers = Math.max(0, Math.round(input.startingCustomers));
  const startingMrrCents = Math.max(0, Math.round(input.startingMrrCents));

  const contractionMrrCents = Math.max(0, Math.round(input.contractionMrrCents ?? 0));
  const churnedMrrCents = Math.max(0, Math.round(input.churnedMrrCents ?? 0));
  const expansionMrrCents = Math.max(0, Math.round(input.expansionMrrCents ?? 0));

  const churnedCustomers = Math.max(0, Math.round(input.churnedCustomers ?? 0));
  const retainedCustomers = input.retainedCustomers !== undefined
    ? Math.max(0, Math.round(input.retainedCustomers))
    : Math.max(0, startingCustomers - churnedCustomers);

  // Retained Base MRR (strictly base revenue without expansion)
  const retainedBaseMrrCents = Math.max(0, startingMrrCents - contractionMrrCents - churnedMrrCents);

  // Ending MRR = Retained Base + Expansion
  const endingMrrCents = retainedBaseMrrCents + expansionMrrCents;

  // GRR Calculation (Strictly capped at 100.0%)
  let grrPct = 100.0;
  if (startingMrrCents > 0) {
    grrPct = Number(Math.min(100.0, Math.max(0.0, (retainedBaseMrrCents / startingMrrCents) * 100)).toFixed(2));
  }

  // NRR Calculation (Uncapped, target >= 130.0%)
  let nrrPct = 100.0;
  if (startingMrrCents > 0) {
    nrrPct = Number(Math.max(0.0, (endingMrrCents / startingMrrCents) * 100).toFixed(2));
  }

  const now = Date.now();
  const id = input.id ?? (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cohort_${now}_${Math.random().toString(36).substring(2, 9)}`);

  return {
    id,
    cohortMonth: input.cohortMonth,
    periodOffset: input.periodOffset,
    startingCustomers,
    retainedCustomers,
    churnedCustomers,
    startingMrrCents,
    retainedBaseMrrCents,
    expansionMrrCents,
    contractionMrrCents,
    churnedMrrCents,
    endingMrrCents,
    grrPct,
    nrrPct,
    calculatedAt: now,
  };
}

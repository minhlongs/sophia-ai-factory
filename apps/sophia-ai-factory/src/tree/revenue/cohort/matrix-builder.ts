/**
 * Triangular Cohort Retention Matrix Builder
 *
 * Implements cell calculation and triangular matrix assembly.
 *
 * Layer: tree/revenue/cohort
 */

import {
  type CohortRetentionCell,
  type CohortRow,
  type CohortTriangularMatrix,
  type CreateCohortCellInput,
  GATE_8_CONSTANTS,
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

/**
 * Builds a triangular cohort retention matrix structure from a list of cells.
 * Groups by cohort month and computes aggregate average NRR and GRR.
 */
export function buildTriangularCohortMatrix(cells: CohortRetentionCell[]): CohortTriangularMatrix {
  const cohortMap = new Map<string, CohortRetentionCell[]>();

  for (const cell of cells) {
    const list = cohortMap.get(cell.cohortMonth) ?? [];
    list.push(cell);
    cohortMap.set(cell.cohortMonth, list);
  }

  const cohorts: CohortRow[] = [];
  let totalNrrSum = 0;
  let totalGrrSum = 0;
  let nonZeroOffsetCellCount = 0;

  // Sort cohorts chronologically
  const sortedMonths = Array.from(cohortMap.keys()).sort();

  for (const month of sortedMonths) {
    const rowCells = cohortMap.get(month) ?? [];
    rowCells.sort((a, b) => a.periodOffset - b.periodOffset);

    const startingCustomers = rowCells[0]?.startingCustomers ?? 0;
    const startingMrrCents = rowCells[0]?.startingMrrCents ?? 0;

    for (const cell of rowCells) {
      if (cell.periodOffset > 0) {
        totalNrrSum += cell.nrrPct;
        totalGrrSum += cell.grrPct;
        nonZeroOffsetCellCount++;
      }
    }

    cohorts.push({
      cohortMonth: month,
      startingCustomers,
      startingMrrCents,
      offsets: rowCells,
    });
  }

  const aggregateAverageNrrPct = nonZeroOffsetCellCount > 0
    ? Number((totalNrrSum / nonZeroOffsetCellCount).toFixed(2))
    : 100.0;

  const aggregateAverageGrrPct = nonZeroOffsetCellCount > 0
    ? Number((totalGrrSum / nonZeroOffsetCellCount).toFixed(2))
    : 100.0;

  const targetNrrAchieved = aggregateAverageNrrPct >= GATE_8_CONSTANTS.TARGET_NRR_PCT;

  return {
    cohorts,
    aggregateAverageNrrPct,
    aggregateAverageGrrPct,
    targetNrrAchieved,
  };
}

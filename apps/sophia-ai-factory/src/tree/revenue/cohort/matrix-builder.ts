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
  GATE_8_CONSTANTS,
} from '@/seed/types/unified-revenue';
import { calculateCohortCell } from './cohort-cell-calculator';

export { calculateCohortCell };

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

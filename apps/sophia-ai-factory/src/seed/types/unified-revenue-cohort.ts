/**
 * Cohort retention and triangular matrix types.
 *
 * @module seed/types/unified-revenue-cohort
 */

/**
 * Single cell in the triangular cohort retention matrix.
 */
export interface CohortRetentionCell {
  id?: string;
  cohortMonth: string; // 'YYYY-MM'
  periodOffset: number; // Month 0 to 24
  startingCustomers: number;
  retainedCustomers: number;
  churnedCustomers: number;
  startingMrrCents: number;
  retainedBaseMrrCents: number;
  expansionMrrCents: number;
  contractionMrrCents: number;
  churnedMrrCents: number;
  endingMrrCents: number;
  grrPct: number; // Gross Revenue Retention %: <= 100.0%
  nrrPct: number; // Net Revenue Retention %: target >= 130.0%
  calculatedAt: number;
}

/**
 * Cohort row in the triangular matrix.
 */
export interface CohortRow {
  cohortMonth: string;
  startingCustomers: number;
  startingMrrCents: number;
  offsets: CohortRetentionCell[];
}

/**
 * Complete triangular cohort retention matrix.
 */
export interface CohortTriangularMatrix {
  cohorts: CohortRow[];
  aggregateAverageNrrPct: number;
  aggregateAverageGrrPct: number;
  targetNrrAchieved: boolean; // aggregateAverageNrrPct >= 130.0
}

/**
 * Input for computing a cohort cell.
 */
export interface CreateCohortCellInput {
  id?: string;
  cohortMonth: string;
  periodOffset: number;
  startingCustomers: number;
  startingMrrCents: number;
  retainedCustomers?: number;
  churnedCustomers?: number;
  expansionMrrCents?: number;
  contractionMrrCents?: number;
  churnedMrrCents?: number;
}

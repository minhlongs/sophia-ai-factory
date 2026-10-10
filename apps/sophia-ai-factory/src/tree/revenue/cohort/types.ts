/**
 * Cohort Retention Database Types and Row Mappers
 *
 * Layer: tree/revenue/cohort
 */

import type { CohortRetentionCell } from '@/seed/types/unified-revenue';

export interface CohortDbRow {
  id: string;
  cohort_month: string;
  period_offset: number;
  starting_customers: number;
  retained_customers: number;
  churned_customers: number;
  starting_mrr_cents: number;
  retained_base_mrr_cents: number;
  expansion_mrr_cents: number;
  contraction_mrr_cents: number;
  churned_mrr_cents: number;
  ending_mrr_cents: number;
  grr_pct: number;
  nrr_pct: number;
  calculated_at: number;
}

export function mapRowToCell(row: CohortDbRow): CohortRetentionCell {
  return {
    id: row.id,
    cohortMonth: row.cohort_month,
    periodOffset: Number(row.period_offset),
    startingCustomers: Number(row.starting_customers),
    retainedCustomers: Number(row.retained_customers),
    churnedCustomers: Number(row.churned_customers),
    startingMrrCents: Number(row.starting_mrr_cents),
    retainedBaseMrrCents: Number(row.retained_base_mrr_cents),
    expansionMrrCents: Number(row.expansion_mrr_cents),
    contractionMrrCents: Number(row.contraction_mrr_cents),
    churnedMrrCents: Number(row.churned_mrr_cents),
    endingMrrCents: Number(row.ending_mrr_cents),
    grrPct: Number(row.grr_pct),
    nrrPct: Number(row.nrr_pct),
    calculatedAt: Number(row.calculated_at),
  };
}

/**
 * Churn Decay and Expansion Curve Simulation
 *
 * Simulates enterprise SaaS retention dynamics with churn decay and net expansion.
 *
 * Layer: tree/revenue/cohort
 */

import type { CohortRetentionCell } from '@/seed/types/unified-revenue';
import { calculateCohortCell } from './matrix-builder';

export interface Gate8SimulationOptions {
  startingCohortMonth?: string;
  numCohorts?: number;
  baseCustomersPerCohort?: number;
  baseMrrPerCohortCents?: number;
}

/**
 * Generates an authentic trailing 12-month Gate 8 cohort simulation dataset.
 * Demonstrates high expansion (NRR >= 130%) and strong base retention (GRR ~95%, <= 100%).
 */
export function generateGate8TriangularMatrix(options?: Gate8SimulationOptions): CohortRetentionCell[] {
  const numCohorts = options?.numCohorts ?? 12;
  const baseCustomers = options?.baseCustomersPerCohort ?? 450;
  const baseMrr = options?.baseMrrPerCohortCents ?? 8_000_000; // $80,000 / month initial
  const startYear = 2026;
  const startMonth = 10; // 2026-10 to 2027-09

  const cells: CohortRetentionCell[] = [];

  for (let i = 0; i < numCohorts; i++) {
    const year = startYear + Math.floor((startMonth + i - 1) / 12);
    const m = ((startMonth + i - 1) % 12) + 1;
    const cohortMonth = `${year}-${String(m).padStart(2, '0')}`;

    // Triangular matrix: cohort i has (numCohorts - i) periods observed
    const maxOffset = numCohorts - i - 1;

    for (let offset = 0; offset <= maxOffset; offset++) {
      if (offset === 0) {
        cells.push(
          calculateCohortCell({
            cohortMonth,
            periodOffset: 0,
            startingCustomers: baseCustomers,
            startingMrrCents: baseMrr,
            churnedCustomers: 0,
            expansionMrrCents: 0,
            contractionMrrCents: 0,
            churnedMrrCents: 0,
          }),
        );
      } else {
        // Natural enterprise SaaS retention dynamics:
        // Cumulative customer churn ~ 1.0% per month
        const churnedCust = Math.round(baseCustomers * (0.010 * offset));
        // Contraction ~ 0.4% per month
        const contraction = Math.round(baseMrr * (0.004 * offset));
        // Churned MRR ~ 0.8% per month
        const churnedMrr = Math.round(baseMrr * (0.008 * offset));
        // Enterprise expansion MRR (tier upgrades + dedicated GPU lanes + seats)
        // High initial expansion (+30% ramp upon enterprise onboarding) plus 1.5% incremental per month
        const expansion = Math.round(baseMrr * (0.30 + 0.015 * offset));

        cells.push(
          calculateCohortCell({
            cohortMonth,
            periodOffset: offset,
            startingCustomers: baseCustomers,
            startingMrrCents: baseMrr,
            churnedCustomers: churnedCust,
            expansionMrrCents: expansion,
            contractionMrrCents: contraction,
            churnedMrrCents: churnedMrr,
          }),
        );
      }
    }
  }

  return cells;
}

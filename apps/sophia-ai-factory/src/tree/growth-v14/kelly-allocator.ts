/**
 * Tree Layer: Fractional Kelly Criterion MCU Allocator
 * Mathematical capital-preservation engine calculating optimal MCU render budgets.
 * Layer: tree/growth-v14 | Max LOC: < 200 | Zero :any | Zero IO
 * @module tree/growth-v14/kelly-allocator
 */

import { KellyAllocationParams } from '@/seed/types/growth-triad-v14';

export interface KellyAllocationResult {
  unconstrainedFraction: number;
  dampenedFraction: number;
  boundedFraction: number;
  allocatedMcu: number;
  isPositiveExpectancy: boolean;
}

/**
 * Calculates the Fractional Half-Kelly budget allocation for video renders.
 * Formulations:
 *   b = max(0.0001, projectedRoas - 1.0)
 *   f* = (p * b - (1 - p)) / b
 *   f_half = 0.5 * max(0, f*)
 *   bounded = clamp(f_half, minFraction, maxFraction)
 */
export function calculateKellyAllocation(
  params: KellyAllocationParams,
  availableMcuBudget: number
): KellyAllocationResult {
  const { winProbability, projectedRoas, halfKelly, minFraction, maxFraction } = params;

  if (availableMcuBudget <= 0) {
    return {
      unconstrainedFraction: 0,
      dampenedFraction: 0,
      boundedFraction: 0,
      allocatedMcu: 0,
      isPositiveExpectancy: false,
    };
  }

  // Payout odds: net profit per unit cost
  const b = Math.max(0.0001, projectedRoas - 1.0);
  const p = Math.max(0, Math.min(1, winProbability));

  // Optimal Kelly fraction: f* = (p * b - q) / b where q = 1 - p
  const unconstrained = (p * b - (1.0 - p)) / b;
  const isPositiveExpectancy = unconstrained > 0;

  let fraction = isPositiveExpectancy ? unconstrained : 0;

  if (halfKelly && isPositiveExpectancy) {
    fraction *= 0.5;
  }

  // Bound within allowed min/max fraction when positive, else clamp to min exploration
  const rawBounded = isPositiveExpectancy
    ? Math.min(maxFraction, Math.max(minFraction, fraction))
    : minFraction;
  const boundedFraction = Number(rawBounded.toFixed(4));

  const allocatedMcu = Math.floor(availableMcuBudget * boundedFraction);

  return {
    unconstrainedFraction: Number(unconstrained.toFixed(4)),
    dampenedFraction: Number(fraction.toFixed(4)),
    boundedFraction,
    allocatedMcu,
    isPositiveExpectancy,
  };
}

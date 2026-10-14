/**
 * Discrepancy Severity Classification, Grouping, and Filtering Helpers
 * @module worker/kv-discrepancy-classifiers
 */

import type { Discrepancy, DiscrepancySeverity } from '@/seed/types/billing-contracts';

/**
 * Classify discrepancy severity based on type and context
 */
export function classifyDiscrepancySeverity(
  type: Discrepancy['type'],
  context?: {
    isRecurring?: boolean;
    affectsBilling?: boolean;
    amount?: number;
  },
): DiscrepancySeverity {
  if (context?.affectsBilling && (context.amount || 0) > 100) {
    return 'critical';
  }

  if (context?.isRecurring || (context?.amount || 0) > 50) {
    return 'high';
  }

  switch (type) {
    case 'credit_mismatch':
    case 'gateway_discrepancy':
      return 'critical';
    case 'missing_in_db':
      return 'high';
    case 'missing_in_kv':
      return 'medium';
    default:
      return 'low';
  }
}

export function groupDiscrepanciesByType(discrepancies: Discrepancy[]): Record<string, number> {
  return discrepancies.reduce(
    (acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}

export function groupDiscrepanciesBySeverity(discrepancies: Discrepancy[]): Record<string, number> {
  return discrepancies.reduce(
    (acc, d) => {
      acc[d.severity] = (acc[d.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
}

/**
 * Filter discrepancies by severity for alerting
 */
export function filterDiscrepanciesBySeverity(
  discrepancies: Discrepancy[],
  minSeverity: DiscrepancySeverity,
): Discrepancy[] {
  const severityOrder: Record<DiscrepancySeverity, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  const minLevel = severityOrder[minSeverity];
  return discrepancies.filter((d) => severityOrder[d.severity] >= minLevel);
}

/**
 * @module seed/types/creative-job-economics
 *
 * Cost classification, error taxonomy, and pure economic helpers
 * for creative media jobs (SUPREME COMMAND #9 — Phase 3).
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

export * from './creative-job-attribution';
export { ErrorCategory, classifyErrorForJob } from './creative-job-error-taxonomy';

// ── Cost Classification ──────────────────────────────────────────────────────

export type CostClassification = 'METERED' | 'UNKNOWN' | 'UNMETERED';

export const CostClassification: Record<CostClassification, CostClassification> = {
  METERED: 'METERED',
  UNKNOWN: 'UNKNOWN',
  UNMETERED: 'UNMETERED',
};

// ── Pure Functions ───────────────────────────────────────────────────────────

/**
 * Classify cost for a media job.
 *
 * - METERED: numeric cost exists (provider exposes per-job cost)
 * - UNMETERED: provider has explicit no-meter contract
 * - UNKNOWN: cost undeterminable (default for most providers)
 */
export function classifyCost(
  costCents: number | undefined | null,
  hasExplicitMeter: boolean,
): CostClassification {
  if (typeof costCents === 'number' && Number.isFinite(costCents)) {
    return CostClassification.METERED;
  }
  if (hasExplicitMeter) {
    return CostClassification.UNMETERED;
  }
  return CostClassification.UNKNOWN;
}

/**
 * Compute gross margin percentage.
 *
 * Formula: ((revenue - cost) / revenue) * 100
 * Returns NULL unless both inputs are non-null and revenue is non-zero.
 */
export function computeGrossMargin(
  providerCents: number | null,
  revenueCents: number | null,
): number | null {
  if (providerCents === null || revenueCents === null) return null;
  if (revenueCents === 0) return null;
  return Math.round(((revenueCents - providerCents) / revenueCents) * 100);
}

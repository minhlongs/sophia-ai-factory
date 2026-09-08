/**
 * @module seed/types/creative-job-economics
 *
 * Cost classification, error taxonomy, and pure economic helpers
 * for creative media jobs (SUPREME COMMAND #9 — Phase 3).
 *
 * Layer rule: seed only — no imports from tree/, forest/, or land/.
 */

// ── Cost Classification ──────────────────────────────────────────────────────

export type CostClassification = 'METERED' | 'UNKNOWN' | 'UNMETERED';

export const CostClassification: Record<CostClassification, CostClassification> = {
  METERED: 'METERED',
  UNKNOWN: 'UNKNOWN',
  UNMETERED: 'UNMETERED',
};

// ── Error Category ───────────────────────────────────────────────────────────

export type ErrorCategory =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'PROVIDER'
  | 'VALIDATION'
  | 'NETWORK'
  | 'INTERNAL'
  | 'UNKNOWN';

export const ErrorCategory: Record<ErrorCategory, ErrorCategory> = {
  AUTH: 'AUTH',
  RATE_LIMIT: 'RATE_LIMIT',
  TIMEOUT: 'TIMEOUT',
  PROVIDER: 'PROVIDER',
  VALIDATION: 'VALIDATION',
  NETWORK: 'NETWORK',
  INTERNAL: 'INTERNAL',
  UNKNOWN: 'UNKNOWN',
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

/**
 * Map an unknown error to the ErrorCategory taxonomy.
 *
 * Inspects error name, message, and known error codes for classification.
 */
export function classifyErrorForJob(err: unknown): ErrorCategory {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    const name = err.name.toLowerCase();

    if (
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('unauthorized') ||
      msg.includes('auth') ||
      msg.includes('api key')
    ) {
      return ErrorCategory.AUTH;
    }
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('throttl')) {
      return ErrorCategory.RATE_LIMIT;
    }
    if (
      name === 'aborterror' ||
      msg.includes('timeout') ||
      msg.includes('timed out')
    ) {
      return ErrorCategory.TIMEOUT;
    }
    if (
      msg.includes('econnrefused') ||
      msg.includes('enotfound') ||
      msg.includes('network') ||
      msg.includes('dns') ||
      msg.includes('connection')
    ) {
      return ErrorCategory.NETWORK;
    }
    if (
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('provider') ||
      msg.includes('upstream')
    ) {
      return ErrorCategory.PROVIDER;
    }
    if (
      msg.includes('validation') ||
      msg.includes('invalid') ||
      msg.includes('schema') ||
      msg.includes('required')
    ) {
      return ErrorCategory.VALIDATION;
    }
    if (
      msg.includes('internal') ||
      msg.includes('unexpected') ||
      msg.includes('panic')
    ) {
      return ErrorCategory.INTERNAL;
    }
  }

  return ErrorCategory.UNKNOWN;
}

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

// ── Attribution (SUPREME COMMAND #10 — Phase 1) ──────────────────────────────

export interface AttributionCandidate {
  sourceEventId: string;
  sourceType: 'conversion' | 'revenue';
  channel: 'tiktok' | 'youtube';
  valueCents: number;
  recordedAt: number;
}

export interface AttributionWindow {
  jobCompletedAt: number;
  windowDays: number;
}

export function isWithinWindow(candidate: { recordedAt: number }, window: AttributionWindow): boolean {
  const windowMs = window.windowDays * 86400 * 1000;
  const elapsed = candidate.recordedAt - window.jobCompletedAt;
  return elapsed >= 0 && elapsed <= windowMs;
}

export function selectLastTouch(
  candidates: AttributionCandidate[],
  window: AttributionWindow,
): AttributionCandidate | null {
  const inWindow = candidates
    .filter((c) => isWithinWindow(c, window))
    .sort((a, b) => a.recordedAt - b.recordedAt);
  return inWindow.length > 0 ? inWindow[inWindow.length - 1] : null;
}

// ── Attribution Failure Taxonomy (SUPREME COMMAND #10 — Phase 6) ──────────────

/**
 * INTERNAL attribution-failure classification — never exposed to end users.
 * NO_CANDIDATE_JOB: no completed job for user within window.
 * ATTRIBUTION_WINDOW_EXPIRED: revenue event outside bounded window.
 * MULTIPLE_CANDIDATES: >1 match, last-touch applied (EXPECTED — log only).
 * WORKSPACE_UNRESOLVED: org_members lookup failed (WARN-level).
 * EVENT_ALREADY_OWNED: provenance row existed (idempotency guard).
 */
export type AttributionFailureKind =
  | 'NO_CANDIDATE_JOB'
  | 'ATTRIBUTION_WINDOW_EXPIRED'
  | 'MULTIPLE_CANDIDATES'
  | 'WORKSPACE_UNRESOLVED'
  | 'EVENT_ALREADY_OWNED';

export const AttributionFailureKind: Record<AttributionFailureKind, AttributionFailureKind> = {
  NO_CANDIDATE_JOB: 'NO_CANDIDATE_JOB',
  ATTRIBUTION_WINDOW_EXPIRED: 'ATTRIBUTION_WINDOW_EXPIRED',
  MULTIPLE_CANDIDATES: 'MULTIPLE_CANDIDATES',
  WORKSPACE_UNRESOLVED: 'WORKSPACE_UNRESOLVED',
  EVENT_ALREADY_OWNED: 'EVENT_ALREADY_OWNED',
};

/** INTERNAL attribution attempt result — never include in API responses. */
export type AttributionOutcome =
  | { status: 'attributed'; revenueCents: number; grossMarginPercent: number | null }
  | { status: 'failed'; kind: AttributionFailureKind; reason: string };

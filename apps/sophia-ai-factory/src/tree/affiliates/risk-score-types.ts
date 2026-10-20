/**
 * risk-score-types.ts — Shared vocabulary for the affiliate risk scorer.
 *
 * Types plus tunables, separated from the rules so a caller (portal, admin
 * queue, nightly job) can depend on the shape and the thresholds without
 * importing the whole scoring module, and so the constants cannot drift from
 * the docs that explain them.
 *
 * Layer: tree (domain-reusable primitive). Pure — no I/O.
 *
 * @module tree/affiliates/risk-score-types
 */

/** One click row as the scorer needs it. Raw IPs are never present here. */
export interface ClickSample {
  /** SHA-256 of the visitor IP. Never the raw address. */
  ipHash: string | null;
  /** Truncated user agent, or null/empty when the client sent none. */
  userAgent: string | null;
  /** Millisecond epoch timestamp of the click. */
  createdAt: number;
}

/** Bilingual reason explaining what a rule measured. */
export interface RuleReason {
  vi: string;
  en: string;
}

/** Verdict for a single rule. */
export interface RuleSignal {
  /** Signal strength in 0..1. 0 means the rule saw nothing concerning. */
  score: number;
  /** Human-readable, bilingual explanation of what was measured. */
  reason: RuleReason;
}

/** Composite verdict for a click window. */
export interface RiskVerdict {
  /** Weighted composite in 0..1. */
  score: number;
  /** True when the composite reached the suspicious threshold. */
  isSuspicious: boolean;
  /** Per-rule breakdown, ordered as documented above. */
  signals: {
    dedup: RuleSignal;
    velocity: RuleSignal;
    botUserAgent: RuleSignal;
  };
}

/** Minimal status shape so this module stays independent of the row type. */
export type PartnerStatusLike = 'active' | 'suspended' | 'under_review';

/** Tunable thresholds. Kept as constants so one edit changes every caller. */
export const RISK_THRESHOLDS = {
  /** Clicks inside this window from one (ip_hash, partner_code) count once. */
  dedupWindowMs: 60_000,
  /** Clicks/hour above which velocity becomes suspicious. */
  velocityPerHour: 20,
  /** Distinct user agents below which velocity is treated as automated. */
  minDistinctUserAgents: 3,
  /** Composite at or above this value flags the partner for review. */
  suspiciousScore: 0.5,
} as const;

/** Rule weights. Sum to 1.0 so the composite cannot leave 0..1. */
export const RISK_WEIGHTS = {
  dedup: 0.4,
  velocity: 0.4,
  botUserAgent: 0.2,
} as const;

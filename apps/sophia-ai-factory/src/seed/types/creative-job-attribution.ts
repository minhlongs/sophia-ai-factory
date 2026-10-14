/**
 * Attribution types and evaluation functions for creative media jobs.
 */

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

export type AttributionOutcome =
  | { status: 'attributed'; revenueCents: number; grossMarginPercent: number | null }
  | { status: 'failed'; kind: AttributionFailureKind; reason: string };

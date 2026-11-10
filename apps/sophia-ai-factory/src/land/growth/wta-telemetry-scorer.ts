/**
 * Deterministic Winner-Take-All (WTA) Video Telemetry Scorer & Sparse-Data Hold
 *
 * Ranks published video jobs using measured `video_analytics` engagement:
 *   score = (clicks * 10) + (shares * 5) + (likes * 2) + (views * (1 + clamp(completionRate, 0, 1)))
 * Tie-breaking: `createdAt` DESC, then ASCII code-point `id` ASC (`<` / `>`).
 * Holds culling & duplication when `< 5` published jobs exist or when optional
 * `sparseData` channel telemetry triggers `evaluateSparseDataGrowthGate`.
 *
 * Layer: land/growth
 * @module land/growth/wta-telemetry-scorer
 */

import {
  evaluateSparseDataGrowthGate,
  type SparseDataGateInput,
} from '@/tree/growth/sparse-data-growth-guard';

export const MIN_WTA_ELIGIBLE_JOBS = 5;

export interface WtaJobTelemetryRow {
  readonly id: string;
  readonly prompt: string;
  readonly createdAt: number;
  readonly views: number;
  readonly completionRate: number;
  readonly clicks: number;
  readonly likes: number;
  readonly shares: number;
}

export interface RankedWtaJob extends WtaJobTelemetryRow {
  readonly compositeScore: number;
}

export interface WtaBiddingHoldDecision {
  readonly hold: boolean;
  readonly reason: string | null;
}

function clampUnitInterval(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value > 1 && value <= 100) return Math.min(1, value / 100);
  return Math.min(1, value);
}

function nonNegativeFinite(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

export function computeWtaCompositeScore(row: WtaJobTelemetryRow): number {
  const clicks = nonNegativeFinite(row.clicks);
  const shares = nonNegativeFinite(row.shares);
  const likes = nonNegativeFinite(row.likes);
  const views = nonNegativeFinite(row.views);
  const completion = clampUnitInterval(row.completionRate);
  return clicks * 10 + shares * 5 + likes * 2 + views * (1 + completion);
}

function compareAsciiIdAsc(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function rankWtaJobsByTelemetry(
  rows: readonly WtaJobTelemetryRow[],
): RankedWtaJob[] {
  const scored: RankedWtaJob[] = rows.map((row) => ({
    ...row,
    compositeScore: computeWtaCompositeScore(row),
  }));

  return scored.sort((a, b) => {
    const scoreDiff = b.compositeScore - a.compositeScore;
    if (Math.abs(scoreDiff) > 1e-9) {
      return scoreDiff;
    }
    const createdDiff = (b.createdAt || 0) - (a.createdAt || 0);
    if (createdDiff !== 0) {
      return createdDiff;
    }
    return compareAsciiIdAsc(a.id, b.id);
  });
}

export function evaluateWtaBiddingHold(
  jobCount: number,
  sparseData?: SparseDataGateInput,
): WtaBiddingHoldDecision {
  if (jobCount < MIN_WTA_ELIGIBLE_JOBS) {
    return {
      hold: true,
      reason: `Insufficient published cohort (${jobCount} < ${MIN_WTA_ELIGIBLE_JOBS} minimum jobs)`,
    };
  }

  if (sparseData) {
    const decision = evaluateSparseDataGrowthGate(sparseData);
    if (!decision.allowThompsonSampling) {
      return {
        hold: true,
        reason: decision.reason,
      };
    }
  }

  return { hold: false, reason: null };
}

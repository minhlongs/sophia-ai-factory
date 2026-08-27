/**
 * Creative Economics investment advisor — ranks creative investments by a
 * composite of ROI (roi-modeling.ts) and learning velocity
 * (learning_velocity table), with explainable recommendation codes.
 *
 * Pure math (rankInvestments and helpers) is I/O-free and deterministic;
 * the server action getInvestmentAdvice composes it over performance_events
 * (MILLISECONDS) + learning_velocity.
 *
 * Scoring: roiScore = clamp(50 + roiPct/2, 0, 100), null ROI → neutral 50.
 * composite = round(0.6 * roiScore + 0.4 * velocityScore), null velocity → 50.
 *
 * @module land/creative-economy/investment-advisor
 */

import type { PerfEventLike, RoiRow } from './roi-modeling';

export type InvestmentRecommendation = 'scale_up' | 'hold' | 'cut_loss' | 'insufficient_data';

/** Input row for ranking: one ROI aggregate joined with optional velocity. */
export interface InvestmentInput {
  entityId: string;
  entityType: string;
  channel: string;
  revenueCents: number;
  costCents: number;
  roiPct: number | null;
  velocityScore: number | null;
}

/** One ranked, explainable advice row. */
export interface InvestmentAdviceRow {
  entityId: string;
  entityType: string;
  channel: string;
  revenueCents: number;
  costCents: number;
  roiPct: number | null;
  velocityScore: number | null;
  roiScore: number;
  compositeScore: number;
  recommendation: InvestmentRecommendation;
  /** Machine-translatable reason codes (UI maps to bilingual strings). */
  reasons: string[];
}

export const NEUTRAL_SCORE = 50;
export const ROI_WEIGHT = 0.6;
export const VELOCITY_WEIGHT = 0.4;
export const SCALE_UP_ROI_PCT = 50;
export const SCALE_UP_VELOCITY = 55;
export const SLOW_LEARNING_VELOCITY = 45;

/** ROI component score: neutral 50 when undefined, clamped to [0, 100]. */
export function computeRoiScore(roiPct: number | null): number {
  if (roiPct === null || !Number.isFinite(roiPct)) return NEUTRAL_SCORE;
  return Math.min(100, Math.max(0, NEUTRAL_SCORE + roiPct / 2));
}

/** Composite score; null velocity falls back to neutral 50. */
export function computeCompositeScore(roiPct: number | null, velocityScore: number | null): number {
  const vel =
    velocityScore === null || !Number.isFinite(velocityScore) ? NEUTRAL_SCORE : velocityScore;
  return Math.round(ROI_WEIGHT * computeRoiScore(roiPct) + VELOCITY_WEIGHT * vel);
}

export function recommend(
  roiPct: number | null,
  velocityScore: number | null,
): InvestmentRecommendation {
  if (roiPct === null) return 'insufficient_data';
  if (roiPct >= SCALE_UP_ROI_PCT && velocityScore !== null && velocityScore >= SCALE_UP_VELOCITY) {
    return 'scale_up';
  }
  if (roiPct >= 0) return 'hold';
  return 'cut_loss';
}

/** Explainable reason codes for the UI to translate. */
export function buildReasons(roiPct: number | null, velocityScore: number | null): string[] {
  const reasons: string[] = [];
  if (roiPct === null) reasons.push('NO_COST_DATA');
  else if (roiPct >= 0) reasons.push('POSITIVE_ROI');
  else reasons.push('NEGATIVE_ROI');

  if (velocityScore === null) reasons.push('NO_VELOCITY_DATA');
  else if (velocityScore >= SCALE_UP_VELOCITY) reasons.push('FAST_LEARNING');
  else if (velocityScore < SLOW_LEARNING_VELOCITY) reasons.push('SLOW_LEARNING');
  else reasons.push('NEUTRAL_LEARNING');
  return reasons;
}

/**
 * Rank investments into advice rows. Deterministic order: compositeScore
 * desc, roiPct desc (nulls last), entityId asc, channel asc.
 */
export function rankInvestments(inputs: InvestmentInput[]): InvestmentAdviceRow[] {
  const rows = inputs.map((input) => ({
    entityId: input.entityId,
    entityType: input.entityType,
    channel: input.channel,
    revenueCents: input.revenueCents,
    costCents: input.costCents,
    roiPct: input.roiPct,
    velocityScore: input.velocityScore,
    roiScore: computeRoiScore(input.roiPct),
    compositeScore: computeCompositeScore(input.roiPct, input.velocityScore),
    recommendation: recommend(input.roiPct, input.velocityScore),
    reasons: buildReasons(input.roiPct, input.velocityScore),
  }));

  rows.sort((a, b) => {
    if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
    const ar = a.roiPct === null ? Number.NEGATIVE_INFINITY : a.roiPct;
    const br = b.roiPct === null ? Number.NEGATIVE_INFINITY : b.roiPct;
    if (br !== ar) return br - ar;
    if (a.entityId !== b.entityId) return a.entityId < b.entityId ? -1 : 1;
    if (a.channel !== b.channel) return a.channel < b.channel ? -1 : 1;
    return 0;
  });

  return rows;
}

/** Join ROI rows with a velocity lookup keyed by `${entityType}:${channel}`. */
export function joinVelocity(
  roiRows: RoiRow[],
  velocityByKey: Map<string, number>,
): InvestmentInput[] {
  return roiRows.map((row) => ({
    entityId: row.entityId,
    entityType: row.entityType,
    channel: row.channel,
    revenueCents: row.revenueCents,
    costCents: row.costCents,
    roiPct: row.roiPct,
    velocityScore: velocityByKey.get(`${row.entityType}:${row.channel}`) ?? null,
  }));
}

/** Map raw performance_events rows (snake_case) to the domain shape. */
export function toPerfEvents(
  rows: Array<{
    entity_type: string;
    entity_id: string;
    channel: string | null;
    event_type: string;
    value_cents: number | null;
  }>,
): PerfEventLike[] {
  return rows.map((r) => ({
    entityType: r.entity_type,
    entityId: r.entity_id,
    channel: r.channel,
    eventType: r.event_type,
    valueCents: r.value_cents ?? 0,
  }));
}

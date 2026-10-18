/**
 * Creative Economics investment advisor types, constants, and row mappers.
 *
 * @module land/creative-economy/investment-advisor-types
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

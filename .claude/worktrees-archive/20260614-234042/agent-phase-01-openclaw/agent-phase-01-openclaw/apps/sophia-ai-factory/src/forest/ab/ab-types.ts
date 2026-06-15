/**
 * A/B Experiment Types
 *
 * Shared types for the A/B title + thumbnail runner.
 * All modules in forest/ab import from here — single source of truth.
 *
 * @module forest/ab/ab-types
 */

export type ExperimentStatus = 'active' | 'decided' | 'expired';
export type WinnerVariant = 'a' | 'b' | 'no_winner';

/** Represents a row in the ab_experiments D1 table. */
export interface AbExperiment {
  id: string;
  videoId: string;
  tenantId: string;
  variantACaption: string;
  variantBCaption: string;
  variantAThumbUrl: string | null;
  variantBThumbUrl: string | null;
  impressionsA: number;
  impressionsB: number;
  conversionsA: number;
  conversionsB: number;
  winner: WinnerVariant | null;
  status: ExperimentStatus;
  createdAt: string;
  decidedAt: string | null;
  offerId: string | null;
  bundleId: string | null;
}

/** Input required to create a new experiment. */
export interface CreateExperimentInput {
  videoId: string;
  tenantId: string;
  variantACaption: string;
  variantBCaption: string;
  variantAThumbUrl?: string;
  variantBThumbUrl?: string;
  offerId?: string;
  bundleId?: string;
}

/** Counter update for a single impression/conversion event. */
export interface ExperimentCounterUpdate {
  experimentId: string;
  variant: 'a' | 'b';
  type: 'impression' | 'conversion';
}

/** Winner evaluation result from winner-picker. */
export interface WinnerEvaluation {
  experimentId: string;
  winner: WinnerVariant;
  ctrA: number;
  ctrB: number;
  reason: string;
}

/** D1 raw row shape (snake_case) — used internally in experiment-store. */
export interface AbExperimentRow {
  id: string;
  video_id: string;
  tenant_id: string;
  variant_a_caption: string;
  variant_b_caption: string;
  variant_a_thumb_url: string | null;
  variant_b_thumb_url: string | null;
  impressions_a: number;
  impressions_b: number;
  conversions_a: number;
  conversions_b: number;
  winner: WinnerVariant | null;
  status: ExperimentStatus;
  created_at: string;
  decided_at: string | null;
  offer_id: string | null;
  bundle_id: string | null;
}

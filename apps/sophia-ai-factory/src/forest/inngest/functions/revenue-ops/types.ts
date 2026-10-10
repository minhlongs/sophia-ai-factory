/**
 * Types and constants for revenue attribution operations.
 * @module forest/inngest/functions/revenue-ops/types
 */

export interface UnattributedJobRow {
  id: string;
  user_id: string;
  completed_at: number;
  provider_cost: number | null;
}

export interface PerformanceEventRow {
  id: string;
  event_type: string;
  channel: string;
  value_cents: number;
  recorded_at: number;
}

export interface AttributionProvenanceRow {
  source_event_id: string;
}

export interface AttributionCandidateWinner {
  sourceEventId: string;
  sourceType: string;
  channel: string;
  valueCents: number;
  recordedAt: number;
}

export const ATTRIBUTION_WINDOW_DAYS = 30;
export const BATCH_SIZE = 100;

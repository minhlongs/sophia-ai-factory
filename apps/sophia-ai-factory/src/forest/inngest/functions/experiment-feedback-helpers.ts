/**
 * Experiment Feedback Cron Helpers
 * Layer: forest (infra orchestrator)
 *
 * @module forest/inngest/functions/experiment-feedback-helpers
 */

export interface DecidedExperimentRow {
  id: string;
  tenant_id: string;
  video_id: string;
  content_type: string;
  variant_a_caption: string;
  variant_b_caption: string;
  variant_a_thumb_url: string | null;
  variant_b_thumb_url: string | null;
  impressions_a: number;
  impressions_b: number;
  conversions_a: number;
  conversions_b: number;
  winner: string;
  decided_at: string;
}

export interface FeedbackResult {
  processed: number;
  written: number;
}

export function buildWinnerPayload(row: DecidedExperimentRow): Record<string, unknown> {
  if (row.winner === 'no_winner') {
    return { decision: 'no_winner', content_type: row.content_type };
  }
  const isA = row.winner === 'a';
  return {
    decision: row.winner,
    content_type: row.content_type,
    winning_caption: isA ? row.variant_a_caption : row.variant_b_caption,
    winning_thumb_url: isA ? row.variant_a_thumb_url : row.variant_b_thumb_url,
    impressions_winner: isA ? row.impressions_a : row.impressions_b,
    impressions_loser: isA ? row.impressions_b : row.impressions_a,
    conversions_winner: isA ? row.conversions_a : row.conversions_b,
    conversions_loser: isA ? row.conversions_b : row.conversions_a,
  };
}

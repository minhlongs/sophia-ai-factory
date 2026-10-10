/**
 * Experiment Types, Interfaces & Database Rows
 *
 * @module tree/performance/experiment/types
 */

import type { ExperimentStatus } from '@/seed/types/creative-domain';

export interface ExperimentResult {
  id: string;
  experimentId: string;
  variantId: string;
  sampleSize: number;
  conversions: number;
  conversionRate: number;
  revenueCents: number;
  metadata: Record<string, unknown>;
  recordedAt: number;
}

export interface ExperimentRow {
  id: string;
  workspace_id: string;
  project_id: string | null;
  hypothesis: string | null;
  metric: string | null;
  audience: string | null;
  channel: string | null;
  status: string;
  started_at: number | null;
  ended_at: number | null;
  winner_variant_id: string | null;
  confidence: number | null;
  result: string | null;
  created_at: number;
  updated_at: number;
}

export interface VariantRow {
  id: string;
  experiment_id: string;
  name: string;
  description: string;
  asset_id: string | null;
  traffic_percent: number;
}

export interface ResultRow {
  id: string;
  experiment_id: string;
  variant_id: string;
  sample_size: number;
  conversions: number;
  conversion_rate: number;
  revenue_cents: number;
  metadata: string | null;
  recorded_at: number;
}

export const EXPERIMENT_STATUSES: readonly ExperimentStatus[] = [
  'draft',
  'running',
  'completed',
  'cancelled',
];

export const VALID_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft: ['running', 'cancelled'],
  running: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

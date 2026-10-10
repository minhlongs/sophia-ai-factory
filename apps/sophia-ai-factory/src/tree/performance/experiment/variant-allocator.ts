/**
 * Experiment Variant Allocation & Domain Mappers
 *
 * @module tree/performance/experiment/variant-allocator
 */

import type { Experiment, ExperimentVariant, ExperimentStatus } from '@/seed/types/creative-domain';
import { EXPERIMENT_STATUSES, VALID_TRANSITIONS, type ExperimentRow, type VariantRow } from './types';

/**
 * Generates a cryptographically random experiment ID.
 */
export function newExperimentId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return 'exp_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Coerces raw string status to typed ExperimentStatus.
 */
export function coerceStatus(raw: string): ExperimentStatus {
  return EXPERIMENT_STATUSES.includes(raw as ExperimentStatus)
    ? (raw as ExperimentStatus)
    : 'draft';
}

/**
 * Checks if status transition from -> to is allowed.
 */
export function isValidTransition(from: ExperimentStatus, to: ExperimentStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Maps database VariantRow to domain ExperimentVariant.
 */
export function variantRowToDomain(row: VariantRow): ExperimentVariant {
  return {
    id: row.id,
    experimentId: row.experiment_id,
    name: row.name,
    description: row.description,
    assetId: row.asset_id ?? undefined,
    trafficPercent: row.traffic_percent,
  };
}

/**
 * Maps database ExperimentRow and its variants to domain Experiment.
 */
export function experimentRowToDomain(
  row: ExperimentRow,
  variants: ExperimentVariant[] = [],
): Experiment {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id ?? '',
    hypothesis: row.hypothesis ?? '',
    metric: row.metric ?? '',
    audience: row.audience ?? '',
    channel: row.channel ?? '',
    status: coerceStatus(row.status),
    variants,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    winnerVariantId: row.winner_variant_id ?? undefined,
    confidence: row.confidence ?? undefined,
    result: row.result ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Allocates a variant using deterministic hash bucketing based on an identifier (e.g. userId).
 */
export function allocateVariantByHash(
  variants: ExperimentVariant[],
  identifier: string
): ExperimentVariant | null {
  if (variants.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < identifier.length; i++) {
    hash = (hash * 31 + identifier.charCodeAt(i)) >>> 0;
  }
  const bucket = hash % 100; // 0..99

  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.trafficPercent;
    if (bucket < cumulative) {
      return v;
    }
  }
  return variants[variants.length - 1];
}

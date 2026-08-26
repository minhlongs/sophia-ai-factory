/**
 * Experiment Engine Bridge — maps production ab_experiments → unified Experiment type.
 * Layer: forest (infrastructure orchestration)
 *
 * Read-only bridge for unified reporting. Writers remain untouched (no dual-write — YAGNI).
 *
 * @module forest/ab/engine-bridge
 */

import type { AbExperiment } from './ab-types';
import type { Experiment, ExperimentVariant, ExperimentStatus } from '@/seed/types/creative-domain';

/**
 * Map production AbExperiment to canonical Experiment domain type.
 * Enables unified reporting across both experiment engines.
 */
export function abExperimentToDomain(ab: AbExperiment): Experiment {
  const status = mapStatus(ab.status);

  const variantA: ExperimentVariant = {
    id: `${ab.id}_a`,
    experimentId: ab.id,
    name: 'A',
    description: ab.variantACaption,
    assetId: ab.variantAThumbUrl ?? undefined,
    trafficPercent: 50,
  };

  const variantB: ExperimentVariant = {
    id: `${ab.id}_b`,
    experimentId: ab.id,
    name: 'B',
    description: ab.variantBCaption,
    assetId: ab.variantBThumbUrl ?? undefined,
    trafficPercent: 50,
  };

  return {
    id: ab.id,
    workspaceId: ab.tenantId,
    projectId: ab.videoId,
    hypothesis: `A/B test for ${ab.contentType}: ${ab.variantACaption} vs ${ab.variantBCaption}`,
    metric: 'click_through_rate',
    audience: 'auto',
    channel: ab.contentType,
    status,
    variants: [variantA, variantB],
    startedAt: new Date(ab.createdAt).getTime() / 1000,
    endedAt: ab.decidedAt ? new Date(ab.decidedAt).getTime() / 1000 : undefined,
    winnerVariantId: ab.winner ? `${ab.id}_${ab.winner}` : undefined,
    confidence: ab.winner ? 0.95 : undefined, // heuristic default when winner decided
    result: ab.winner ? `Variant ${ab.winner.toUpperCase()} won` : undefined,
    createdAt: new Date(ab.createdAt).getTime() / 1000,
    updatedAt: ab.decidedAt ? new Date(ab.decidedAt).getTime() / 1000 : new Date(ab.createdAt).getTime() / 1000,
  };
}

/**
 * Map production status to canonical ExperimentStatus.
 */
function mapStatus(status: AbExperiment['status']): ExperimentStatus {
  switch (status) {
    case 'active':
      return 'running';
    case 'decided':
      return 'completed';
    case 'expired':
      return 'cancelled';
    default:
      return 'draft';
  }
}

/**
 * Convert array of production experiments for bulk reporting.
 */
export function abExperimentsToDomain(abExperiments: AbExperiment[]): Experiment[] {
  return abExperiments.map(abExperimentToDomain);
}

export { mapStatus };
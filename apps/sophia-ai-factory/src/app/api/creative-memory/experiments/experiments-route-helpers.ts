/**
 * Validation schemas and builder for /api/creative-memory/experiments
 *
 * @module app/api/creative-memory/experiments/experiments-route-helpers
 */

import { z } from 'zod';
import { newExperimentId } from '@/tree/performance/experiment';
import type {
  Experiment,
  ExperimentStatus,
  ExperimentVariant,
} from '@/seed/types/creative-domain';

export const EXPERIMENT_STATUSES = ['draft', 'running', 'completed', 'cancelled'] as const;

export const GetExperimentsSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  projectId: z.string().optional(),
  status: z.enum(EXPERIMENT_STATUSES).optional(),
});

export const VariantInputSchema = z.object({
  name: z.string().min(1, 'variant name is required'),
  description: z.string().optional().default(''),
  assetId: z.string().optional(),
  trafficPercent: z.number().min(0).max(100),
});

export const CreateExperimentSchema = z.object({
  workspaceId: z.string().min(1, 'workspaceId is required'),
  projectId: z.string().optional().default(''),
  hypothesis: z.string().optional().default(''),
  metric: z.string().optional().default('ctr'),
  audience: z.string().optional().default(''),
  channel: z.string().optional().default(''),
  status: z.enum(EXPERIMENT_STATUSES).optional().default('draft'),
  variants: z.array(VariantInputSchema).optional().default([]),
});

export type CreateExperimentParsedInput = z.output<typeof CreateExperimentSchema>;

export function buildExperimentRecord(input: CreateExperimentParsedInput): Experiment {
  const { workspaceId, projectId, hypothesis, metric, audience, channel, status, variants } = input;
  const experimentId = newExperimentId();
  const domainVariants: ExperimentVariant[] = variants.map((v, idx) => ({
    id: `var_${experimentId.slice(4)}_${idx + 1}`,
    experimentId,
    name: v.name,
    description: v.description,
    assetId: v.assetId,
    trafficPercent: v.trafficPercent,
  }));

  const now = Math.floor(Date.now() / 1000);
  return {
    id: experimentId,
    workspaceId,
    projectId,
    hypothesis,
    metric,
    audience,
    channel,
    status: status as ExperimentStatus,
    variants: domainVariants,
    createdAt: now,
    updatedAt: now,
  };
}

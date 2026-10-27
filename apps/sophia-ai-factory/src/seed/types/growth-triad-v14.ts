/**
 * Seed Layer: Growth Triad v14 Contracts & Schemas
 * Type contracts and Zod schemas for Predictive Rendering, Kelly Allocation & Concurrency Hardening.
 * Layer: seed/types | Max LOC: < 200 | Zero :any
 * @module seed/types/growth-triad-v14
 */

import { z } from 'zod';

export const RenderJobStatusSchema = z.enum([
  'QUEUED',
  'STAGE_1_RENDERING',
  'HALTED_EARLY',
  'COMPLETED',
  'FAILED',
]);
export type RenderJobStatus = z.infer<typeof RenderJobStatusSchema>;

export const PredictiveRenderJobSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  scriptId: z.string().min(1),
  mabArmId: z.string().optional(),
  deliberationScore: z.number().min(0).max(100),
  kellyAllocationFraction: z.number().min(0).max(1),
  allocatedMcu: z.number().int().positive(),
  actualMcuConsumed: z.number().int().nonnegative().default(0),
  status: RenderJobStatusSchema,
  earlyHaltProbability: z.number().min(0).max(1).optional(),
  haltReason: z.string().optional(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});
export type PredictiveRenderJob = z.infer<typeof PredictiveRenderJobSchema>;

export const KellyAllocationParamsSchema = z.object({
  winProbability: z.number().min(0).max(1),
  projectedRoas: z.number().positive(),
  halfKelly: z.boolean().default(true),
  minFraction: z.number().min(0).max(1).default(0.05),
  maxFraction: z.number().min(0).max(1).default(0.40),
  /** Separately approved exploration budget; never implied by minFraction. */
  approvedExplorationFraction: z.number().min(0).max(1).default(0),
});
export type KellyAllocationParams = z.infer<typeof KellyAllocationParamsSchema>;

export const SurvivalPredictionParamsSchema = z.object({
  interimRetentionScore: z.number().min(0).max(1),
  priorAlpha: z.number().positive().default(2.0),
  priorBeta: z.number().positive().default(2.0),
  sampleSize: z.number().int().nonnegative().default(10),
  criticalCutoffPercentile: z.number().min(0).max(1).default(0.25),
});
export type SurvivalPredictionParams = z.infer<typeof SurvivalPredictionParamsSchema>;

export const CircuitStateSchema = z.enum(['CLOSED', 'HALF_OPEN', 'OPEN']);
export type CircuitState = z.infer<typeof CircuitStateSchema>;

export const FailureClassificationSchema = z.enum([
  'TRANSIENT_RATE_LIMIT',
  'DOWNSTREAM_TIMEOUT',
  'INVALID_BYOK_KEY',
  'PERMANENT_SCHEMA_ERROR',
  'UNKNOWN_ERROR',
]);
export type FailureClassification = z.infer<typeof FailureClassificationSchema>;

export const CircuitEventSchema = z.object({
  id: z.string().min(1),
  resourceId: z.string().min(1),
  classification: FailureClassificationSchema,
  errorMessage: z.string().optional(),
  state: CircuitStateSchema,
  consecutiveFailures: z.number().int().nonnegative(),
  retryAfterTimestamp: z.number().int().optional(),
  createdAt: z.number().int().positive(),
});
export type CircuitEvent = z.infer<typeof CircuitEventSchema>;

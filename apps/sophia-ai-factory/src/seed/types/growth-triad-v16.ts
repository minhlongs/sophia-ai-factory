/**
8 * Seed Layer: Growth Triad v16 Type Definitions & Schemas
8 * Type definitions for Bayesian Prior Video Script Optimization Bridge,
8 * Adaptive Prompt Steering, and Dynamic Retention-Guided Constraints.
8 * Layer: seed/types | Max LOC: < 200 | Zero :any
8 * @module seed/types/growth-triad-v16
8 */

import { z } from 'zod';

export const PriorScriptSteeringSchema = z.object({
  targetHookDropoffThreshold: z.number().min(0).max(100).default(25),
  expectedRetentionMultiplier: z.number().min(0).max(2).default(1.0),
  winningHookArchetype: z.string().optional(),
  pacingDirective: z.string().optional(),
  dimensionWeights: z.record(z.string(), z.number()).optional(),
});
export type PriorScriptSteering = z.infer<typeof PriorScriptSteeringSchema>;

export interface BayesianScriptContext {
  userId: string;
  topic: string;
  audience: string;
  priors: {
    hookAlpha: number;
    hookBeta: number;
    expectedHookRetention: number;
    retentionAlpha: number;
    retentionBeta: number;
    expectedOverallRetention: number;
    sampleSize: number;
  };
  steering: PriorScriptSteering;
}

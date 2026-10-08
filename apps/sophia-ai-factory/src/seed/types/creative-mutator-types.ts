/**
 * @file creative-mutator-types.ts
 * @description Domain types and Zod schemas for Darwinian Creative Auto-Mutator
 * @layer seed
 */

import { z } from 'zod';

export const HOOK_ARCHETYPES = [
  'STATISTIC_PAIN',
  'POLARIZING_VERDICT',
  'FINANCIAL_LOSS_WARNING',
  'AUTOMATION_PROOF',
  'HIGH_CURIOSITY_LIST',
  'EXCLUSIVE_ACCESS',
] as const;

export type HookArchetype = (typeof HOOK_ARCHETYPES)[number];

export const MUTATION_INTENSITIES = ['CONSERVATIVE', 'MODERATE', 'RADICAL'] as const;
export type MutationIntensity = (typeof MUTATION_INTENSITIES)[number];

export const TRIGGER_REASONS = [
  'HOOK_FATIGUE',
  'LOW_RETENTION',
  'WINNING_ARM_EXPLORE',
  'MANUAL',
] as const;
export type TriggerReason = (typeof TRIGGER_REASONS)[number];

export const MutationGeneSchema = z.object({
  hookArchetype: z.enum(HOOK_ARCHETYPES),
  hookScriptText: z.string().min(5).max(300),
  visualStyle: z.string().min(3).max(100),
  cameraMotion: z.string().min(3).max(100),
  pacingMultiplier: z.number().min(0.8).max(1.3),
  ctaText: z.string().min(3).max(150),
});

export type MutationGene = z.infer<typeof MutationGeneSchema>;

export const MutationDeltaSchema = z.object({
  parentHookArchetype: z.enum(HOOK_ARCHETYPES),
  offspringHookArchetype: z.enum(HOOK_ARCHETYPES),
  visualShift: z.string(),
  pacingDelta: z.number(),
  mutationIntensity: z.enum(MUTATION_INTENSITIES),
});

export type MutationDelta = z.infer<typeof MutationDeltaSchema>;

export interface FitnessEvaluation {
  hookScore: number;
  retentionScore: number;
  roiPercent: number;
  compositeFitness: number;
  isPromotedOffspring: boolean;
  gainVsParentPercent: number;
}

export interface CreativeMutationRecord {
  id: string;
  userId: string;
  parentJobId: string;
  offspringJobId: string | null;
  generation: number;
  mutationIntensity: MutationIntensity;
  triggerReason: TriggerReason;
  parentGene: MutationGene;
  offspringGene: MutationGene;
  delta: MutationDelta;
  parentFitness: number;
  offspringFitness: number | null;
  status: 'PENDING_RENDER' | 'DISPATCHED' | 'EVALUATED' | 'PRUNED';
  createdAt: string;
  updatedAt: string;
}

export const TriggerMutationInputSchema = z.object({
  parentJobId: z.string().min(1),
  generation: z.number().int().min(0).default(0),
  mutationIntensity: z.enum(MUTATION_INTENSITIES).default('MODERATE'),
  triggerReason: z.enum(TRIGGER_REASONS).default('MANUAL'),
  customOverrides: z
    .object({
      targetHookArchetype: z.enum(HOOK_ARCHETYPES).optional(),
      targetVisualStyle: z.string().optional(),
      pacingMultiplier: z.number().min(0.8).max(1.3).optional(),
    })
    .optional(),
});

export type TriggerMutationInput = z.infer<typeof TriggerMutationInputSchema>;

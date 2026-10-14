/**
 * Hook Scoring & Evaluation Contracts
 *
 * Layer: seed/types/creative-intelligence
 */

import { z } from 'zod';

/** Canonical 6 hook style classifications */
export const HookStyleSchema = z.enum([
  'curiosity_gap',
  'bold_claim',
  'problem_agitation',
  'question',
  'story_lead',
  'statistic_reveal',
]);
export type HookStyle = z.infer<typeof HookStyleSchema>;

/** Input payload for evaluating a video script hook */
export const HookEvaluationInputSchema = z.object({
  hookText: z.string().min(1, 'hookText is required'),
  hookStyle: HookStyleSchema.optional(),
  transcriptText: z.string().optional(),
  scores: z
    .object({
      hookScore: z.number().min(0).max(1).optional(),
      pacingScore: z.number().min(0).max(1).optional(),
      retentionScore: z.number().min(0).max(1).optional(),
      ctaScore: z.number().min(0).max(1).optional(),
    })
    .optional(),
});
export type HookEvaluationInput = z.infer<typeof HookEvaluationInputSchema>;

/** Output result of viral hook scoring calculation */
export const HookScoreResultSchema = z.object({
  viralScore: z.number().min(0).max(1),
  hookScore: z.number().min(0).max(1),
  pacingScore: z.number().min(0).max(1),
  retentionScore: z.number().min(0).max(1),
  ctaScore: z.number().min(0).max(1),
  detectedHookStyle: HookStyleSchema,
  weights: z.object({
    hook: z.literal(0.4),
    pacing: z.literal(0.25),
    retention: z.literal(0.2),
    cta: z.literal(0.15),
  }),
  reasoning: z.string().optional(),
});
export type HookScoreResult = z.infer<typeof HookScoreResultSchema>;

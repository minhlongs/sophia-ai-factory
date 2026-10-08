/**
 * Growth Triad v13 Type Definitions & Zod Schemas
 * MAB A/B Video Optimizer, Creative Deliberation & Shapley Profit Ledger
 * Layer: seed/types | Max LOC: < 200 | Zero :any
 * @module seed/types/growth-triad-v13
 */

import { z } from 'zod';

export type BanditExperimentStatus = 'ACTIVE' | 'CONVERGED' | 'PAUSED';
export type BanditArmStatus = 'ACTIVE' | 'WINNER' | 'PRUNED';

export const banditArmSchema = z.object({
  id: z.string().min(1),
  experimentId: z.string().min(1),
  hookText: z.string().min(3),
  alphaSuccesses: z.number().nonnegative(),
  betaFailures: z.number().nonnegative(),
  pullCount: z.number().int().nonnegative(),
  conversionCount: z.number().int().nonnegative(),
  trafficWeight: z.number().min(0).max(1),
  status: z.enum(['ACTIVE', 'WINNER', 'PRUNED']),
});
export type BanditArm = z.infer<typeof banditArmSchema>;

export const banditExperimentSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  experimentName: z.string().min(1),
  status: z.enum(['ACTIVE', 'CONVERGED', 'PAUSED']),
  winningArmId: z.string().nullable().optional(),
  totalPulls: z.number().int().nonnegative(),
  arms: z.array(banditArmSchema),
  convergenceThreshold: z.number().min(0.5).max(0.99).default(0.95),
  minPullsBeforeConvergence: z.number().int().positive().default(50),
});
export type BanditExperiment = z.infer<typeof banditExperimentSchema>;

export type DeliberationLens = 'HOOK_ANALYST' | 'RETENTION_CRITIC' | 'COMPLIANCE_GUARD';
export type DeliberationVerdict = 'APPROVED' | 'REVISE' | 'REJECTED';

export const lensEvaluationSchema = z.object({
  lens: z.enum(['HOOK_ANALYST', 'RETENTION_CRITIC', 'COMPLIANCE_GUARD']),
  score: z.number().min(0).max(100),
  feedback: z.string().min(1),
  suggestedRevision: z.string().optional(),
});
export type LensEvaluation = z.infer<typeof lensEvaluationSchema>;

export const creativeDeliberationReportSchema = z.object({
  scriptId: z.string().min(1),
  userId: z.string().min(1),
  originalScript: z.string().min(10),
  compositeScore: z.number().min(0).max(100),
  verdict: z.enum(['APPROVED', 'REVISE', 'REJECTED']),
  evaluations: z.array(lensEvaluationSchema).length(3),
  refinedScript: z.string().optional(),
});
export type CreativeDeliberationReport = z.infer<typeof creativeDeliberationReportSchema>;

export const touchpointRecordSchema = z.object({
  videoManifestId: z.string().min(1),
  channelId: z.string().min(1),
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']),
  timestamp: z.number().positive(),
  mcuCostUsd: z.number().nonnegative(),
});
export type TouchpointRecord = z.infer<typeof touchpointRecordSchema>;

export const shapleyAttributionItemSchema = z.object({
  videoManifestId: z.string().min(1),
  channelId: z.string().min(1),
  platform: z.enum(['YOUTUBE_SHORTS', 'TIKTOK_V2', 'INSTAGRAM_REELS']),
  shapleyWeight: z.number().min(0).max(1),
  attributedRevenueUsd: z.number().nonnegative(),
  mcuCostUsd: z.number().nonnegative(),
  netProfitUsd: z.number(),
  roas: z.number().nonnegative(),
});
export type ShapleyAttributionItem = z.infer<typeof shapleyAttributionItemSchema>;

export const shapleyAttributionResultSchema = z.object({
  conversionId: z.string().min(1),
  totalGrossRevenueUsd: z.number().nonnegative(),
  totalCommissionUsd: z.number().nonnegative(),
  touchpoints: z.array(shapleyAttributionItemSchema),
  overallRoas: z.number().nonnegative(),
});
export type ShapleyAttributionResult = z.infer<typeof shapleyAttributionResultSchema>;

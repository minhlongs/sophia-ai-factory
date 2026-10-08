/**
 * @file growth-triad-v5-types.ts
 * @description Seed Layer type definitions and Zod schemas for Growth Triad v5
 * @layer seed
 */

import { z } from 'zod';

// ============================================================================
// Pillar 1: Dynamic LTV Price Elasticity & Paywall MAB
// ============================================================================

export const PaywallArmSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  priceTier: z.string().min(1),
  priceUsd: z.number().positive(),
  alphaSuccess: z.number().positive(),
  betaFailure: z.number().positive(),
  impressions: z.number().nonnegative(),
  conversions: z.number().nonnegative(),
  revenueUsd: z.number().nonnegative(),
  isActive: z.boolean(),
});
export type PaywallArm = z.infer<typeof PaywallArmSchema>;

export const RfmWtpInputSchema = z.object({
  daysSinceLastActive: z.number().nonnegative(),
  loginCount30d: z.number().nonnegative(),
  mcuBurnRate30d: z.number().nonnegative(),
  maxMcuBaseline: z.number().positive().default(1000),
});
export type RfmWtpInput = z.infer<typeof RfmWtpInputSchema>;

// ============================================================================
// Pillar 2: Creator Recruitment & Outreach FSM
// ============================================================================

export const KolPlatformSchema = z.enum(['TIKTOK', 'YOUTUBE_SHORTS', 'INSTAGRAM_REELS']);
export type KolPlatform = z.infer<typeof KolPlatformSchema>;

export const KolScoutInputSchema = z.object({
  platform: KolPlatformSchema,
  handle: z.string().min(1),
  followerCount: z.number().positive(),
  medianViews: z.number().positive(),
  totalInteractions: z.number().nonnegative(),
  samplePostCount: z.number().positive(),
});
export type KolScoutInput = z.infer<typeof KolScoutInputSchema>;

export const KolStatusSchema = z.enum([
  'SCOUTED',
  'OUTREACH_INTRO_SENT',
  'OUTREACH_CASE_STUDY_SENT',
  'NEGOTIATING_SPLIT',
  'AGREEMENT_SIGNED',
  'UNSUBSCRIBED',
]);
export type KolStatus = z.infer<typeof KolStatusSchema>;

export const KolLeadRecordSchema = z.object({
  id: z.string(),
  platform: KolPlatformSchema,
  handle: z.string(),
  followerCount: z.number(),
  medianViews: z.number(),
  engagementRate: z.number(),
  qualityScore: z.number(),
  currentSplitPct: z.number(),
  status: KolStatusSchema,
  unsubscribed: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type KolLeadRecord = z.infer<typeof KolLeadRecordSchema>;

// ============================================================================
// Pillar 3: AI Dynamic Thumbnail & Hook A/B Auto-Tester
// ============================================================================

export const AbTestStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE_TESTING',
  'CALCULATING_SIGNIFICANCE',
  'WINNER_PROMOTED',
  'ARCHIVED',
]);
export type AbTestStatus = z.infer<typeof AbTestStatusSchema>;

export const AbVariantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hookText: z.string().min(1),
  thumbnailUrl: z.string().url().optional(),
  impressions: z.number().nonnegative(),
  clicks: z.number().nonnegative(),
  isControl: z.boolean().default(false),
  isPromotedWinner: z.boolean().default(false),
});
export type AbVariant = z.infer<typeof AbVariantSchema>;

export const AbSignificanceResultSchema = z.object({
  hasSignificantWinner: z.boolean(),
  winnerVariantId: z.string().optional(),
  posteriorProbabilityBeatControl: z.number().min(0).max(1),
  pvalueChiSquare: z.number().min(0).max(1),
  confidenceLevelPct: z.number().min(0).max(100),
});
export type AbSignificanceResult = z.infer<typeof AbSignificanceResultSchema>;

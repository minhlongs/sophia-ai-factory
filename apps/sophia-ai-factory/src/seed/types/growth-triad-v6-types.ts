/**
 * @file growth-triad-v6-types.ts
 * @description Seed Layer type definitions and Zod schemas for Growth Triad v6
 * @layer seed
 */

import { z } from 'zod';

// ============================================================================
// Pillar 1: Multi-Modal Search-Surge SEO & Trend Jacker
// ============================================================================

export const SearchIntentSchema = z.enum([
  'INFORMATIONAL',
  'COMMERCIAL',
  'TRANSACTIONAL',
]);
export type SearchIntent = z.infer<typeof SearchIntentSchema>;

export const SearchVelocityPointSchema = z.object({
  timestamp: z.number(),
  velocity: z.number().nonnegative(),
});
export type SearchVelocityPoint = z.infer<typeof SearchVelocityPointSchema>;

export const SurgeDetectionResultSchema = z.object({
  keyword: z.string().min(1),
  currentVelocity: z.number().nonnegative(),
  meanVelocity: z.number().nonnegative(),
  stdDev: z.number().nonnegative(),
  zScore: z.number(),
  isSurging: z.boolean(),
  intent: SearchIntentSchema,
});
export type SurgeDetectionResult = z.infer<typeof SurgeDetectionResultSchema>;

export const SeoChapterSchema = z.object({
  time: z.string(),
  title: z.string(),
});

export const SeoMetadataOutputSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  chapters: z.array(SeoChapterSchema),
});
export type SeoMetadataOutput = z.infer<typeof SeoMetadataOutputSchema>;

// ============================================================================
// Pillar 2: Autonomous Affiliate Smart-Link Yield Optimizer
// ============================================================================

export const AffiliateNetworkSchema = z.enum([
  'CLICKBANK',
  'CJ',
  'AMAZON',
  'TIKTOK_SHOP',
]);
export type AffiliateNetwork = z.infer<typeof AffiliateNetworkSchema>;

export const AffiliateOfferSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  network: AffiliateNetworkSchema,
  targetUrl: z.string().url(),
  epcUsd: z.number().nonnegative(),
  gravity: z.number().nonnegative(),
  refundRatePct: z.number().min(0).max(100),
  commissionPct: z.number().min(0).max(100),
  niche: z.string().min(1),
});
export type AffiliateOffer = z.infer<typeof AffiliateOfferSchema>;

export const SmartLinkMatchResultSchema = z.object({
  offerId: z.string(),
  offerName: z.string(),
  expectedYieldUsd: z.number().nonnegative(),
  geoRoutingUrl: z.string(),
  fallbackNetwork: AffiliateNetworkSchema,
});
export type SmartLinkMatchResult = z.infer<typeof SmartLinkMatchResultSchema>;

// ============================================================================
// Pillar 3: Predictive Viewer Retention & Survival Heatmap Auto-Trimmer
// ============================================================================

export const RetentionSecondBucketSchema = z.object({
  second: z.number().int().nonnegative(),
  viewers: z.number().int().nonnegative(),
  dropoffs: z.number().int().nonnegative(),
});
export type RetentionSecondBucket = z.infer<typeof RetentionSecondBucketSchema>;

export const SurvivalCurvePointSchema = z.object({
  second: z.number().int().nonnegative(),
  survivalRate: z.number().min(0).max(1),
  dropRatePerSec: z.number(),
});
export type SurvivalCurvePoint = z.infer<typeof SurvivalCurvePointSchema>;

export const RetentionCliffSchema = z.object({
  startSecond: z.number().int().nonnegative(),
  endSecond: z.number().int().nonnegative(),
  dropSeverity: z.number().positive(),
  recommendedTrimSec: z.number().nonnegative(),
});
export type RetentionCliff = z.infer<typeof RetentionCliffSchema>;

export const RetentionTrimStatusSchema = z.enum([
  'MONITORING',
  'CLIFF_DETECTED',
  'TRIM_RECOMMENDED',
  'PACING_OPTIMIZED',
]);
export type RetentionTrimStatus = z.infer<typeof RetentionTrimStatusSchema>;

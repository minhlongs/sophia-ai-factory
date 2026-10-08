/**
 * @file growth-triad-v2-types.ts
 * @description Seed layer types & Zod schemas for Voice Cart Closer, Ad Arbitrage MAB & Parasite SEO
 * @layer seed
 */

import { z } from 'zod';

// ==========================================
// 1. Voice Cart Recovery Types
// ==========================================
export const CartObjectionTypeSchema = z.enum([
  'PRICE_TOO_HIGH',
  'SHIPPING_COST',
  'TRUST_ISSUE',
  'COMPARE_OTHER',
  'ACCIDENTAL_ADD',
  'UNKNOWN',
]);
export type CartObjectionType = z.infer<typeof CartObjectionTypeSchema>;

export const VoiceCallStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'RECOVERED_CONVERTED',
  'FAILED_UNANSWERED',
  'REJECTED',
  'DNC_SKIPPED',
]);
export type VoiceCallStatus = z.infer<typeof VoiceCallStatusSchema>;

export const AbandonedCartCallRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  cartSessionId: z.string(),
  customerPhone: z.string(),
  customerName: z.string().optional(),
  cartValue: z.number().nonnegative(),
  currency: z.string().default('VND'),
  productNames: z.array(z.string()),
  callStatus: VoiceCallStatusSchema,
  objectionDetected: CartObjectionTypeSchema.optional(),
  offeredVoucherCode: z.string().optional(),
  offeredDiscountPercent: z.number().min(0).max(100).optional(),
  recordingDurationSeconds: z.number().nonnegative().default(0),
  convertedGmv: z.number().nonnegative().default(0),
  callTimestamp: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type AbandonedCartCallRecord = z.infer<typeof AbandonedCartCallRecordSchema>;

// ==========================================
// 2. Ad Arbitrage MAB Types
// ==========================================
export const AdPlatformSchema = z.enum(['TIKTOK_ADS', 'META_GRAPH', 'GOOGLE_ADS']);
export type AdPlatform = z.infer<typeof AdPlatformSchema>;

export const AdBanditActionSchema = z.enum([
  'SCALE_BUDGET',
  'MAINTAIN',
  'REDUCE_BUDGET',
  'PAUSE_STOP_LOSS',
]);
export type AdBanditAction = z.infer<typeof AdBanditActionSchema>;

export const AdArbitrageCampaignSchema = z.object({
  id: z.string(),
  userId: z.string(),
  platform: AdPlatformSchema,
  campaignExternalId: z.string(),
  campaignName: z.string(),
  dailyBudget: z.number().nonnegative(),
  rollingSpend24h: z.number().nonnegative(),
  rollingGmv24h: z.number().nonnegative(),
  rollingClicks24h: z.number().nonnegative(),
  rollingConversions24h: z.number().nonnegative(),
  cpa: z.number().nonnegative(),
  roas: z.number().nonnegative(),
  epc: z.number().nonnegative(),
  status: z.enum(['ACTIVE', 'PAUSED_STOP_LOSS', 'SCALING', 'EXPLORING']),
  recommendedAction: AdBanditActionSchema,
  lastRebalancedAt: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type AdArbitrageCampaign = z.infer<typeof AdArbitrageCampaignSchema>;

// ==========================================
// 3. Parasite SEO Types
// ==========================================
export const ParasitePlatformSchema = z.enum([
  'MEDIUM',
  'SUBSTACK',
  'LINKEDIN_PULSE',
  'WORDPRESS_NETWORK',
]);
export type ParasitePlatform = z.infer<typeof ParasitePlatformSchema>;

export const ParasiteSeoArticleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  skuCode: z.string(),
  title: z.string(),
  targetPlatform: ParasitePlatformSchema,
  canonicalSlug: z.string(),
  cloakedBridgeUrl: z.string(),
  targetKeywords: z.array(z.string()),
  schemaOrgJsonLd: z.string(),
  seoContentMarkdown: z.string(),
  seoScore: z.number().min(0).max(100),
  status: z.enum(['DRAFT', 'PUBLISHED', 'SYNCING', 'ARCHIVED']),
  publishedExternalUrl: z.string().optional(),
  organicImpressions: z.number().nonnegative().default(0),
  organicClicks: z.number().nonnegative().default(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type ParasiteSeoArticle = z.infer<typeof ParasiteSeoArticleSchema>;

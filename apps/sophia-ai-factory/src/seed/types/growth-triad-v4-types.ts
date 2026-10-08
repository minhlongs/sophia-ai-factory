/**
 * @file growth-triad-v4-types.ts
 * @description Domain types and Zod schemas for Growth Triad v4
 * @layer seed
 */

import { z } from 'zod';

export const ChurnRiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export type ChurnRiskLevel = z.infer<typeof ChurnRiskLevelSchema>;

export const ChurnHazardInputSchema = z.object({
  daysSinceLastActive: z.number().nonnegative(),
  loginCount30d: z.number().nonnegative(),
  mcuBurnRate30d: z.number().nonnegative(),
  supportTicketCount: z.number().nonnegative(),
});
export type ChurnHazardInput = z.infer<typeof ChurnHazardInputSchema>;

export const ChurnWinbackOfferSchema = z.object({
  discountPercentage: z.number().min(0).max(50),
  bonusMcu: z.number().nonnegative(),
  campaignDurationDays: z.number().positive(),
  guardedMarginFloorUsd: z.number().nonnegative(),
});
export type ChurnWinbackOffer = z.infer<typeof ChurnWinbackOfferSchema>;

export const AffiliateEpcInputSchema = z.object({
  campaignId: z.string().min(1),
  clicks7d: z.number().nonnegative(),
  conversions7d: z.number().nonnegative(),
  grossRevenueUsd: z.number().nonnegative(),
});
export type AffiliateEpcInput = z.infer<typeof AffiliateEpcInputSchema>;

export const AffiliateTierSchema = z.enum(['STANDARD', 'SILVER_SCALE', 'GOLD_SCALE', 'DIAMOND_ELITE']);
export type AffiliateTier = z.infer<typeof AffiliateTierSchema>;

export const RepurposeTargetFormatSchema = z.enum(['TIKTOK_9_16', 'YOUTUBE_SHORTS_9_16', 'INSTAGRAM_REELS_9_16', 'SQUARE_FEED_1_1']);
export type RepurposeTargetFormat = z.infer<typeof RepurposeTargetFormatSchema>;

export const SaliencyCropBoxSchema = z.object({
  sourceWidth: z.number().positive(),
  sourceHeight: z.number().positive(),
  targetWidth: z.number().positive(),
  targetHeight: z.number().positive(),
  focalPointX: z.number().min(0).max(1),
  focalPointY: z.number().min(0).max(1),
  cropX: z.number().nonnegative(),
  cropY: z.number().nonnegative(),
  cropWidth: z.number().positive(),
  cropHeight: z.number().positive(),
});
export type SaliencyCropBox = z.infer<typeof SaliencyCropBoxSchema>;

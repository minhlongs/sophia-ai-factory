/**
 * @file growth-triad-v7-types.ts
 * @description Seed Layer type definitions and Zod schemas for Growth Triad v7
 * @layer seed
 */

import { z } from 'zod';

// ============================================================================
// Pillar 1: Dynamic Brand Sponsorship Valuation & Pitch Engine
// ============================================================================

export const ContentNicheSchema = z.enum([
  'FINANCE',
  'SAAS',
  'CRYPTO',
  'TECH',
  'LIFESTYLE',
]);
export type ContentNiche = z.infer<typeof ContentNicheSchema>;

export const SponsorshipValuationInputSchema = z.object({
  channelId: z.string().min(1),
  channelName: z.string().min(1),
  niche: ContentNicheSchema,
  expected30dViews: z.number().positive(),
  engagementRate: z.number().min(0).max(1),
  tier1AudiencePct: z.number().min(0).max(100),
  baseCpmUsd: z.number().positive().default(25.0),
});
export type SponsorshipValuationInput = z.infer<typeof SponsorshipValuationInputSchema>;

export const SponsorshipRateCardSchema = z.object({
  dedicatedVideoUsd: z.number().positive(),
  sixtySecMidRollUsd: z.number().positive(),
  thirtySecPreRollUsd: z.number().positive(),
  shoutoutOrCommunityUsd: z.number().positive(),
  effectiveCpmUsd: z.number().positive(),
});
export type SponsorshipRateCard = z.infer<typeof SponsorshipRateCardSchema>;

export const BrandPitchEmailSchema = z.object({
  subject: z.string(),
  body: z.string(),
  rateCard: SponsorshipRateCardSchema,
});
export type BrandPitchEmail = z.infer<typeof BrandPitchEmailSchema>;

// ============================================================================
// Pillar 2: Intelligent Multi-Aspect Saliency Re-Framer & Kinetic Captioner
// ============================================================================

export const AspectRatioSchema = z.enum(['16:9', '9:16', '1:1', '4:5']);
export type AspectRatio = z.infer<typeof AspectRatioSchema>;

export const KeyframeFocalPointSchema = z.object({
  timestampSec: z.number().nonnegative(),
  focalX: z.number().min(0).max(1),
  focalY: z.number().min(0).max(1),
  faceDetected: z.boolean(),
});
export type KeyframeFocalPoint = z.infer<typeof KeyframeFocalPointSchema>;

export const CropWindowSchema = z.object({
  timestampSec: z.number().nonnegative(),
  cropX: z.number().min(0).max(1),
  cropY: z.number().min(0).max(1),
  cropWidth: z.number().min(0).max(1),
  cropHeight: z.number().min(0).max(1),
});
export type CropWindow = z.infer<typeof CropWindowSchema>;

export const KineticSubtitleTokenSchema = z.object({
  word: z.string(),
  startSec: z.number().nonnegative(),
  endSec: z.number().nonnegative(),
  emphasis: z.boolean(),
  highlightColor: z.string(),
});
export type KineticSubtitleToken = z.infer<typeof KineticSubtitleTokenSchema>;

export const ReframeJobOutputSchema = z.object({
  videoId: z.string(),
  sourceAspect: AspectRatioSchema,
  targetAspect: AspectRatioSchema,
  cropWindows: z.array(CropWindowSchema),
  tokens: z.array(KineticSubtitleTokenSchema),
  jitterScore: z.number().min(0).max(1),
});
export type ReframeJobOutput = z.infer<typeof ReframeJobOutputSchema>;

// ============================================================================
// Pillar 3: Visual Saliency Thumbnail Matrix & Simulated CTR Gaze Predictor
// ============================================================================

export const ThumbnailGazeInputSchema = z.object({
  thumbnailId: z.string().min(1),
  luminanceContrastRatio: z.number().positive(),
  faceProminenceIndex: z.number().min(0).max(1),
  colorSaturation: z.number().min(0).max(1),
  ruleOfThirdsAdherence: z.number().min(0).max(1),
  textOverlayAreaPct: z.number().min(0).max(100),
});
export type ThumbnailGazeInput = z.infer<typeof ThumbnailGazeInputSchema>;

export const SaliencyReportSchema = z.object({
  saliencyScore: z.number().min(0).max(1),
  predictedCtrPct: z.number().min(0).max(100),
  gazeFixationGrade: z.enum(['GRADE_A', 'GRADE_B', 'GRADE_C', 'POOR']),
  recommendations: z.array(z.string()),
});
export type SaliencyReport = z.infer<typeof SaliencyReportSchema>;

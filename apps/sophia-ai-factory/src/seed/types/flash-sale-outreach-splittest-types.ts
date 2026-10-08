/**
 * @file flash-sale-outreach-splittest-types.ts
 * @description Zod Schemas & TypeScript interfaces for Flash-Sale Sync, Competitor Outreach & Split-Test Attribution
 * @layer seed
 */

import { z } from 'zod';

export const OUTREACH_STATUSES = ['DISCOVERED', 'DISPATCHED', 'CONVERTED', 'OPT_OUT', 'SUPPRESSED'] as const;
export const SPLITTEST_STATUSES = ['RUNNING', 'WINNER_DECLARED', 'AUTO_CUT_TRIGGERED', 'STOPPED'] as const;
export const SPLITTEST_WINNERS = ['VARIANT_A', 'VARIANT_B', 'INCONCLUSIVE'] as const;

export const LiveFlashSaleCampaignSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  offerId: z.string().min(1),
  voucherCode: z.string().min(1),
  discountPercentage: z.number().int().min(1).max(100),
  stockRemaining: z.number().int().min(0),
  surgeThresholdPercentage: z.number().int().min(5).max(100).default(20),
  isActive: z.number().int().min(0).max(1).default(1),
  expiresAt: z.number().int().min(0),
  createdAt: z.number().int().min(0),
});
export type LiveFlashSaleCampaign = z.infer<typeof LiveFlashSaleCampaignSchema>;

export const CompetitorOutreachLeadSchema = z.object({
  id: z.string().min(1),
  competitorChannel: z.string().min(1),
  targetVideoId: z.string().min(1),
  commentAuthorId: z.string().min(1),
  commentText: z.string().min(1),
  intentScore: z.number().int().min(0).max(100).default(50),
  outreachStatus: z.enum(OUTREACH_STATUSES).default('DISCOVERED'),
  messageTemplateUsed: z.string().nullable().optional(),
  dispatchedAt: z.number().int().nullable().optional(),
  createdAt: z.number().int().min(0),
});
export type CompetitorOutreachLead = z.infer<typeof CompetitorOutreachLeadSchema>;

export const VideoSplitTestExperimentSchema = z.object({
  id: z.string().min(1),
  campaignId: z.string().min(1),
  hookAVideoId: z.string().min(1),
  hookBVideoId: z.string().min(1),
  trafficSplitRatio: z.number().min(0.1).max(0.9).default(0.5),
  variantAViews: z.number().int().min(0).default(0),
  variantAClicks: z.number().int().min(0).default(0),
  variantAConversions: z.number().int().min(0).default(0),
  variantBViews: z.number().int().min(0).default(0),
  variantBClicks: z.number().int().min(0).default(0),
  variantBConversions: z.number().int().min(0).default(0),
  status: z.enum(SPLITTEST_STATUSES).default('RUNNING'),
  winnerVariant: z.enum(SPLITTEST_WINNERS).nullable().optional(),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});
export type VideoSplitTestExperiment = z.infer<typeof VideoSplitTestExperimentSchema>;

/**
 * @file live-stream-newsjack-dm-types.ts
 * @description Type definitions and Zod schemas for Live Stream, Newsjacking & DM Funnel
 * @layer seed
 */

import { z } from 'zod';

export const LIVE_STREAM_PLATFORMS = ['tiktok', 'shopee', 'youtube', 'twitch'] as const;
export type LiveStreamPlatform = (typeof LIVE_STREAM_PLATFORMS)[number];

export const LIVE_STREAM_STATUSES = ['IDLE', 'BROADCASTING', 'PAUSED', 'ENDED', 'ERROR'] as const;
export type LiveStreamStatus = (typeof LIVE_STREAM_STATUSES)[number];

export const TREND_SOURCES = ['google_trends_rss', 'tiktok_creative_center', 'x_trends'] as const;
export type TrendSource = (typeof TREND_SOURCES)[number];

export const NEWSJACK_STATUSES = ['PENDING', 'GENERATING', 'COMPLETED', 'DISMISSED', 'FAILED'] as const;
export type NewsjackStatus = (typeof NEWSJACK_STATUSES)[number];

export const DM_PLATFORMS = ['tiktok', 'instagram', 'youtube', 'telegram', 'whatsapp'] as const;
export type DmPlatform = (typeof DM_PLATFORMS)[number];

export const FUNNEL_STATES = ['NEW', 'QUALIFIED', 'LINK_SENT', 'CLICKED', 'CONVERTED', 'LOST', 'OPTED_OUT'] as const;
export type FunnelState = (typeof FUNNEL_STATES)[number];

export const LEDGER_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SETTLED'] as const;
export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

export const LiveStreamSessionSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().min(1).max(120),
  platform: z.enum(LIVE_STREAM_PLATFORMS),
  streamKeyMasked: z.string().min(1),
  loopVideoUrl: z.string().url(),
  status: z.enum(LIVE_STREAM_STATUSES).default('IDLE'),
  currentPinnedOfferId: z.string().nullable().optional(),
  viewersCount: z.number().int().min(0).default(0),
  qaTurnaroundMs: z.number().int().min(0).default(850),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});
export type LiveStreamSession = z.infer<typeof LiveStreamSessionSchema>;

export const NewsjackSignalSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  trendTopic: z.string().min(1).max(200),
  trendSource: z.enum(TREND_SOURCES),
  viralityScore: z.number().int().min(0).max(100).default(50),
  pairedOfferId: z.string().nullable().optional(),
  pairedSimilarityScore: z.number().min(0).max(1).default(0),
  status: z.enum(NEWSJACK_STATUSES).default('PENDING'),
  generatedVideoJobId: z.string().nullable().optional(),
  createdAt: z.number().int().min(0),
});
export type NewsjackSignal = z.infer<typeof NewsjackSignalSchema>;

export const DmLeadSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(DM_PLATFORMS),
  platformUserId: z.string().min(1),
  platformUsername: z.string().nullable().optional(),
  sourceVideoId: z.string().nullable().optional(),
  sourceCommentId: z.string().nullable().optional(),
  initialIntent: z.string().nullable().optional(),
  funnelState: z.enum(FUNNEL_STATES).default('NEW'),
  assignedOfferId: z.string().nullable().optional(),
  leadScore: z.number().int().min(0).max(100).default(10),
  optedOut: z.number().int().min(0).max(1).default(0),
  createdAt: z.number().int().min(0),
  updatedAt: z.number().int().min(0),
});
export type DmLead = z.infer<typeof DmLeadSchema>;

export const DmConversionLedgerSchema = z.object({
  id: z.string().min(1),
  leadId: z.string().min(1),
  offerId: z.string().min(1),
  clickId: z.string().min(1),
  subId: z.string().min(1),
  utmCampaign: z.string().nullable().optional(),
  affiliateNetwork: z.string().min(1),
  status: z.enum(LEDGER_STATUSES).default('PENDING'),
  payoutAmountCents: z.number().int().min(0).default(0),
  currency: z.string().default('USD'),
  postbackPayload: z.string().nullable().optional(),
  convertedAt: z.number().int().nullable().optional(),
  createdAt: z.number().int().min(0),
});
export type DmConversionLedger = z.infer<typeof DmConversionLedgerSchema>;

export const LiveQaInputSchema = z.object({
  sessionId: z.string().min(1),
  commentText: z.string().min(1).max(500),
  username: z.string().min(1),
  productTitle: z.string().min(1),
});
export type LiveQaInput = z.infer<typeof LiveQaInputSchema>;

export const CommentTriggerInputSchema = z.object({
  platform: z.enum(DM_PLATFORMS),
  platformUserId: z.string().min(1),
  commentText: z.string().min(1).max(500),
  sourceVideoId: z.string().optional(),
  sourceCommentId: z.string().optional(),
  targetOfferId: z.string().optional(),
});
export type CommentTriggerInput = z.infer<typeof CommentTriggerInputSchema>;

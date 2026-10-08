/**
 * @file growth-triad-v3-types.ts
 * @description Domain types and Zod schemas for Growth Triad v3
 * @layer seed
 */

import { z } from 'zod';

// ==========================================
// 1. B2B Cold Outreach & Lead Qualifier
// ==========================================
export const OutreachChannelSchema = z.enum(['EMAIL', 'LINKEDIN', 'TWITTER']);
export type OutreachChannel = z.infer<typeof OutreachChannelSchema>;

export const LeadStatusSchema = z.enum([
  'DISCOVERED',
  'WARMING',
  'CONTACTED',
  'REPLIED_INTERESTED',
  'BOOKED_DEMO',
  'UNSUBSCRIBED',
  'BOUNCED',
]);
export type LeadStatus = z.infer<typeof LeadStatusSchema>;

export const B2bLeadRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  email: z.string().email(),
  fullName: z.string().optional(),
  companyDomain: z.string(),
  isCorporateDomain: z.boolean(),
  intentScore: z.number().min(0).max(100),
  status: LeadStatusSchema,
  channel: OutreachChannelSchema,
  warmupRampDay: z.number().int().nonnegative().default(1),
  bookingUrl: z.string().optional(),
  lastContactedAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type B2bLeadRecord = z.infer<typeof B2bLeadRecordSchema>;

// ==========================================
// 2. TikTok Shop Creator Outreach & Sample CRM
// ==========================================
export const SampleGateStatusSchema = z.enum([
  'PENDING_EVALUATION',
  'AUTO_APPROVED',
  'MANUAL_REVIEW',
  'REJECTED_LOW_METRICS',
  'DISPATCHED',
  'VIDEO_DELIVERED',
]);
export type SampleGateStatus = z.infer<typeof SampleGateStatusSchema>;

export const CommissionTierSchema = z.enum(['TIER_1_STANDARD', 'TIER_2_GROWTH', 'TIER_3_ELITE']);
export type CommissionTier = z.infer<typeof CommissionTierSchema>;

export const TikTokCreatorRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  creatorHandle: z.string(),
  followerCount: z.number().nonnegative(),
  rollingGmv30d: z.number().nonnegative(),
  engagementRate: z.number().min(0).max(1),
  sampleStatus: SampleGateStatusSchema,
  commissionTier: CommissionTierSchema,
  sampleTrackingCode: z.string().optional(),
  videoDeadlineDays: z.number().int().nonnegative().default(7),
  attributedSalesCount: z.number().int().nonnegative().default(0),
  createdAt: z.number(),
  updatedAt: z.number(),
});
export type TikTokCreatorRecord = z.infer<typeof TikTokCreatorRecordSchema>;

// ==========================================
// 3. Omnichannel Attribution & Dynamic Splitter
// ==========================================
export const AttributionModelSchema = z.enum(['FIRST_TOUCH', 'LAST_TOUCH', 'TIME_DECAY']);
export type AttributionModel = z.infer<typeof AttributionModelSchema>;

export const TouchpointRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  conversionId: z.string(),
  channelSource: z.string(),
  weightPercentage: z.number().min(0).max(100),
  attributedGmv: z.number().nonnegative(),
  ltvCacRatio: z.number().nonnegative(),
  payoutStatus: z.enum(['PENDING', 'CALCULATED', 'DISBURSED']),
  createdAt: z.number(),
});
export type TouchpointRecord = z.infer<typeof TouchpointRecordSchema>;

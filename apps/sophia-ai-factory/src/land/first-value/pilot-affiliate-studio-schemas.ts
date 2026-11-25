/**
 * Zod schemas for Pilot Affiliate Campaign Studio actions on `/api/first-value`.
 *
 * Separated so `first-value-http-schemas.ts` stays concise under 200 LOC.
 *
 * @module land/first-value/pilot-affiliate-studio-schemas
 */

import { z } from 'zod';

const SafeHttpsUrlSchema = z
  .string()
  .trim()
  .min(4)
  .max(1000)
  .transform((val) => (/^[a-z][a-z0-9+.-]*:\/\//i.test(val) ? val : `https://${val}`))
  .refine((val) => {
    try {
      const parsed = new URL(val);
      return (
        (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
        Boolean(parsed.hostname) &&
        parsed.hostname.includes('.')
      );
    } catch {
      return false;
    }
  }, 'Valid http(s) URL is required');

const EditableSceneSchema = z.object({
  scene_number: z.number().int().min(1).max(30),
  title: z.string().trim().min(1).max(200).optional(),
  visual_description: z.string().trim().min(1).max(1500),
  narration: z.string().trim().min(1).max(2000),
  duration_estimate: z.number().min(1).max(120),
});

export const EditableCampaignPackSchema = z.object({
  campaignTitle: z.string().trim().min(3).max(240),
  audienceAnalysis: z.string().trim().min(5).max(2500),
  valueProposition: z.string().trim().min(5).max(2000),
  contentAngles: z.array(z.string().trim().min(3).max(400)).min(2).max(6),
  hook: z.string().trim().min(3).max(600),
  callToAction: z.string().trim().min(5).max(1000),
  shortFormScript: z.object({
    title: z.string().trim().min(2).max(300),
    total_duration: z.number().min(5).max(600),
    scenes: z.array(EditableSceneSchema).min(3).max(12),
  }),
  socialPost: z.string().trim().min(5).max(4000),
  affiliateDisclosure: z.string().trim().min(2).max(1500),
  referralUrl: SafeHttpsUrlSchema,
});

export const SaveAffiliateOfferActionSchema = z.object({
  action: z.literal('save_affiliate_offer'),
  orgId: z.string().min(1).max(128),
  vertical: z.enum(['crypto', 'saas']),
  productName: z.string().trim().min(2).max(160),
  officialWebsiteUrl: SafeHttpsUrlSchema,
  referralUrl: SafeHttpsUrlSchema,
  commissionTerms: z.string().trim().min(3).max(400),
  targetAudience: z.string().trim().min(3).max(300),
  targetMarket: z.string().trim().min(2).max(64),
  productInfoSource: z.string().trim().min(3).max(500),
});

export const ArchiveAffiliateOfferActionSchema = z.object({
  action: z.literal('archive_affiliate_offer'),
  orgId: z.string().min(1).max(128),
  offerId: z.string().min(3).max(128),
});

export const GenerateAffiliateCampaignActionSchema = z.object({
  action: z.literal('generate_affiliate_campaign'),
  orgId: z.string().min(1).max(128),
  offerId: z.string().min(3).max(128),
  durationSec: z.number().int().min(15).max(180).optional().default(30),
  locale: z.enum(['vi', 'en']).optional().default('vi'),
  provenance: z.enum(['fixture_simulated', 'live_provider']).optional().default('live_provider'),
  idempotencyKey: z.string().min(8).max(128).trim().optional(),
});

export const EditAffiliateCampaignActionSchema = z.object({
  action: z.literal('edit_affiliate_campaign'),
  orgId: z.string().min(1).max(128),
  campaignId: z.string().min(3).max(128),
  expectedVersion: z.number().int().min(1),
  pack: EditableCampaignPackSchema,
  locale: z.enum(['vi', 'en']).optional().default('vi'),
  idempotencyKey: z.string().min(8).max(128).trim().optional(),
});

export const ApproveAffiliateCampaignActionSchema = z.object({
  action: z.literal('approve_affiliate_campaign'),
  orgId: z.string().min(1).max(128),
  campaignId: z.string().min(3).max(128),
  expectedVersion: z.number().int().min(1),
  explicitUserAction: z.literal(true),
  idempotencyKey: z.string().min(8).max(128).trim().optional(),
});

export const ExportAffiliateCampaignActionSchema = z.object({
  action: z.literal('export_affiliate_campaign'),
  orgId: z.string().min(1).max(128),
  campaignId: z.string().min(3).max(128),
  format: z.enum(['markdown', 'json']).default('markdown'),
  idempotencyKey: z.string().min(8).max(128).trim().optional(),
});

export const RecordPartnerPerformanceActionSchema = z
  .object({
    action: z.literal('record_partner_performance'),
    orgId: z.string().min(1).max(128),
    campaignId: z.string().min(3).max(128),
    reportSource: z.string().trim().min(3).max(240),
    reportPeriod: z.string().trim().min(2).max(100),
    externalRefId: z.string().trim().min(3).max(128),
    clicksCount: z.number().int().min(0).max(10_000_000).nullable().optional(),
    signupsCount: z.number().int().min(0).max(1_000_000).default(0),
    qualifiedConversions: z.number().int().min(0).max(1_000_000).default(0),
    pendingCommissionUsd: z.number().min(0).max(25_000_000_000).default(0),
    confirmedCommissionUsd: z.number().min(0).max(25_000_000_000).default(0),
    currency: z.enum(['USD', 'USDT', 'EUR', 'VND']).optional().default('USD'),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((val, ctx) => {
    const maxCap = val.currency === 'VND' ? 25_000_000_000 : 1_000_000;
    if (val.pendingCommissionUsd > maxCap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['pendingCommissionUsd'],
        message: `Pending commission exceeds maximum allowed for ${val.currency}`,
      });
    }
    if (val.confirmedCommissionUsd > maxCap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmedCommissionUsd'],
        message: `Confirmed commission exceeds maximum allowed for ${val.currency}`,
      });
    }
  });

export const PilotAffiliateStudioActionSchemas = [
  SaveAffiliateOfferActionSchema,
  ArchiveAffiliateOfferActionSchema,
  GenerateAffiliateCampaignActionSchema,
  EditAffiliateCampaignActionSchema,
  ApproveAffiliateCampaignActionSchema,
  ExportAffiliateCampaignActionSchema,
  RecordPartnerPerformanceActionSchema,
] as const;

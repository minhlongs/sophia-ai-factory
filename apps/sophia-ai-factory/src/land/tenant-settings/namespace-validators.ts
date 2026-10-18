/**
 * Per-namespace Zod validators for tenant settings.
 * Stub schemas — each feature agent will harden these when they own their namespace.
 * @module lib/tenant-settings/namespace-validators
 */

import { z } from 'zod';
import type { SettingsNamespace } from '@/seed/tenant-settings/types';
import {
  ChannelTemplateSchema,
  ChannelsSchema,
  McpCustomServerSchema,
  McpSchema,
  PassthroughSchema,
  StorageSchema,
  WebhooksDefaultsSchema,
} from './namespace-integration-schemas';

export {
  ChannelTemplateSchema,
  ChannelsSchema,
  McpCustomServerSchema,
  McpSchema,
  PassthroughSchema,
  StorageSchema,
  WebhooksDefaultsSchema,
};

// ---------- per-namespace schemas ----------

const httpsUrlOrNull = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://'), { message: 'URL must use HTTPS' })
  .nullable();

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex colour, e.g. #7c3aed');

export const BrandingSchema = z.object({
  logoUrl: httpsUrlOrNull,
  primaryColor: hexColorSchema,
  accentColor: hexColorSchema.nullable(),
  welcomeMessage: z.string().max(2000).nullable(),
  customDomain: z.string().nullable(),
  emailFromName: z.string().max(100).nullable(),
  emailFooter: z.string().max(1000).nullable(),
  faviconUrl: httpsUrlOrNull,
  socialMeta: z
    .object({
      title: z.string().max(200).nullable(),
      description: z.string().max(500).nullable(),
      imageUrl: httpsUrlOrNull,
    })
    .nullable(),
});

export const ScoringSchema = z.object({
  weights: z
    .object({
      commission: z.number().min(0).max(1),
      cookieDuration: z.number().min(0).max(1),
      payoutSpeed: z.number().min(0).max(1),
      programAge: z.number().min(0).max(1),
      approvalRate: z.number().min(0).max(1),
    })
    .partial(), // user may override only some weights
  threshold: z.number().min(0).max(1),
});

export const GeoSchema = z.object({
  // Tenant adds extra blocks beyond defaults
  additionalRules: z
    .array(
      z.object({
        category: z.string().min(1),
        blockedCountries: z.array(z.string().regex(/^[A-Z]{2}$/)),
        reason: z.string().optional(),
      }),
    )
    .default([]),
  // Tenant removes a specific country from a default block
  removedRules: z
    .array(
      z.object({
        category: z.string(),
        country: z.string().regex(/^[A-Z]{2}$/),
      }),
    )
    .default([]),
});

export const CronSchema = z.object({
  affiliateScoutCadenceHours: z.number().int().min(1).max(168), // 1h to 1 week
  contentProducerCron: z.string().regex(/^[\d*/,\- ]+$/),
  enabled: z.object({
    affiliateScout: z.boolean(),
    contentProducer: z.boolean(),
  }),
});

// ---------- lookup map ----------

export const NAMESPACE_VALIDATORS: Record<
  SettingsNamespace,
  z.ZodTypeAny
> = {
  branding: BrandingSchema,
  scoring: ScoringSchema,
  geo: GeoSchema,
  cron: CronSchema,
  channels: ChannelsSchema,
  mcp: McpSchema,
  'webhooks-defaults': WebhooksDefaultsSchema,
  storage: StorageSchema,
  misc: PassthroughSchema,
};

/** Returns a parse function for use with registry.set() / registry.merge(). */
export function validatorFor(namespace: SettingsNamespace): (v: unknown) => unknown {
  const schema = NAMESPACE_VALIDATORS[namespace] ?? PassthroughSchema;
  return (v: unknown) => schema.parse(v);
}

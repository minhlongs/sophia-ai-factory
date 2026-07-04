/**
 * Per-namespace Zod validators for tenant settings.
 * Stub schemas — each feature agent will harden these when they own their namespace.
 * @module lib/tenant-settings/namespace-validators
 */

import { z } from 'zod';
import type { SettingsNamespace } from './types';

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
  agencyName: z.string().max(200).nullable(),
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

export const ChannelTemplateSchema = z
  .object({
    titleTemplate: z.string().max(200).optional(),
    captionTemplate: z.string().max(2200).optional(),
    hashtagsTemplate: z.string().max(500).optional(),
    ctaTemplate: z.string().max(500).optional(),
  })
  .partial();

export const ChannelsSchema = z.object({
  defaultPlatforms: z.array(z.string()),
  templates: z
    .record(
      z.enum(['youtube', 'tiktok', 'instagram', 'pinterest', 'linkedin', 'zalo']),
      ChannelTemplateSchema,
    )
    .optional()
    .default(() => ({} as Record<'youtube' | 'tiktok' | 'instagram' | 'pinterest' | 'linkedin' | 'zalo', z.infer<typeof ChannelTemplateSchema>>)),
  preferTemplateOverAI: z.boolean().default(false),
});

export const McpCustomServerSchema = z.object({
  name: z.string().min(1).max(64),
  url: z.string().url().refine(u => u.startsWith('https://'), {
    message: 'MCP server URL must use HTTPS',
  }),
  authType: z.enum(['none', 'bearer', 'header']),
  authValue: z.string().optional(),
  enabled: z.boolean().default(true),
  description: z.string().max(500).optional(),
});

export const McpSchema = z.object({
  enabledServers: z.array(z.string()),
  customEndpoints: z.array(
    z.object({
      name: z.string().min(1),
      url: z.string().url(),
    }),
  ),
  customServers: z.array(McpCustomServerSchema).max(20).default([]),
});

export const WebhooksDefaultsSchema = z.object({
  retryCount: z.number().int().min(0).max(10),
  timeoutMs: z.number().int().min(1000).max(60000),
});

export const StorageSchema = z.object({
  r2AccessKeyId: z.string().min(1).max(256).nullable(),
  r2SecretAccessKey: z.string().min(1).max(256).nullable(),
  r2BucketName: z.string().min(1).max(128).nullable(),
  r2Endpoint: z.string().url().nullable(),
  r2PublicBaseUrl: z.string().url().nullable(),
  useTenantStorage: z.boolean().default(false),
});

/** Passthrough for misc and any future un-typed namespaces. */
export const PassthroughSchema = z.unknown();

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

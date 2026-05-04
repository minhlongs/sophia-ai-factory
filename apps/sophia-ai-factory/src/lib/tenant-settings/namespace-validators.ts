/**
 * Per-namespace Zod validators for tenant settings.
 * Stub schemas — each feature agent will harden these when they own their namespace.
 * @module lib/tenant-settings/namespace-validators
 */

import { z } from 'zod';
import type { SettingsNamespace } from './types';

// ---------- per-namespace schemas ----------

export const BrandingSchema = z.object({
  logoUrl: z.string().url().nullable(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be a 6-digit hex colour, e.g. #7c3aed'),
  welcomeMessage: z.string().max(500).nullable(),
  customDomain: z.string().nullable(),
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

export const ChannelsSchema = z.object({
  defaultPlatforms: z.array(z.string()),
});

export const McpSchema = z.object({
  enabledServers: z.array(z.string()),
  customEndpoints: z.array(
    z.object({
      name: z.string().min(1),
      url: z.string().url(),
    }),
  ),
});

export const WebhooksDefaultsSchema = z.object({
  retryCount: z.number().int().min(0).max(10),
  timeoutMs: z.number().int().min(1000).max(60000),
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
  misc: PassthroughSchema,
};

/** Returns a parse function for use with registry.set() / registry.merge(). */
export function validatorFor(namespace: SettingsNamespace): (v: unknown) => unknown {
  const schema = NAMESPACE_VALIDATORS[namespace] ?? PassthroughSchema;
  return (v: unknown) => schema.parse(v);
}

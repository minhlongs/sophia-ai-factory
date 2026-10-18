/**
 * Integration, Channels, MCP, Webhooks, and Storage Zod schemas for tenant settings.
 * @module seed/tenant-settings/integration-namespace-schemas
 */

import { z } from 'zod';

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

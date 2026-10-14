/**
 * Default values per namespace.
 * Used by registry.getOrDefault() when no row exists for a tenant.
 * @module lib/tenant-settings/defaults
 */

import type { SettingsNamespace } from './types';
import type {
  SocialMeta,
  BrandingSettings,
  ScoringSettings,
  GeoSettings,
  CronSettings,
  ChannelTemplate,
  ChannelProvider,
  ChannelsSettings,
  McpCustomServer,
  McpSettings,
  WebhooksDefaultsSettings,
  StorageSettings,
  MiscSettings,
} from './default-shapes';

export type {
  SocialMeta,
  BrandingSettings,
  ScoringSettings,
  GeoSettings,
  CronSettings,
  ChannelTemplate,
  ChannelProvider,
  ChannelsSettings,
  McpCustomServer,
  McpSettings,
  WebhooksDefaultsSettings,
  StorageSettings,
  MiscSettings,
};

export const DEFAULT_BRANDING: BrandingSettings = {
  logoUrl: null,
  primaryColor: '#7c3aed',
  accentColor: null,
  agencyName: null,
  welcomeMessage: null,
  customDomain: null,
  emailFromName: null,
  emailFooter: null,
  faviconUrl: null,
  socialMeta: null,
};

export const DEFAULT_SCORING: ScoringSettings = {
  weights: {
    commission: 0.4,
    cookieDuration: 0.2,
    payoutSpeed: 0.15,
    programAge: 0.15,
    approvalRate: 0.1,
  },
  threshold: 0.7,
};

export const DEFAULT_GEO: GeoSettings = {
  additionalRules: [],
  removedRules: [],
};

export const DEFAULT_CRON: CronSettings = {
  affiliateScoutCadenceHours: 4,
  contentProducerCron: '0 6 * * *',
  enabled: {
    affiliateScout: true,
    contentProducer: true,
  },
};

export const DEFAULT_CHANNELS: ChannelsSettings = {
  defaultPlatforms: [],
  templates: {},
  preferTemplateOverAI: false,
};

export const DEFAULT_MCP: McpSettings = {
  enabledServers: [],
  customEndpoints: [],
  customServers: [],
};

export const DEFAULT_WEBHOOKS_DEFAULTS: WebhooksDefaultsSettings = {
  retryCount: 3,
  timeoutMs: 10000,
};

export const DEFAULT_STORAGE: StorageSettings = {
  r2AccessKeyId: null,
  r2SecretAccessKey: null,
  r2BucketName: null,
  r2Endpoint: null,
  r2PublicBaseUrl: null,
  useTenantStorage: false,
};

export const DEFAULT_MISC: MiscSettings = {};

/** Lookup table: namespace → its default value. */
export const NAMESPACE_DEFAULTS: Record<SettingsNamespace, unknown> = {
  branding: DEFAULT_BRANDING,
  scoring: DEFAULT_SCORING,
  geo: DEFAULT_GEO,
  cron: DEFAULT_CRON,
  channels: DEFAULT_CHANNELS,
  mcp: DEFAULT_MCP,
  'webhooks-defaults': DEFAULT_WEBHOOKS_DEFAULTS,
  storage: DEFAULT_STORAGE,
  misc: DEFAULT_MISC,
};

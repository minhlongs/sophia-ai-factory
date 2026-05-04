/**
 * Default values per namespace.
 * Used by registry.getOrDefault() when no row exists for a tenant.
 * @module lib/tenant-settings/defaults
 */

import type { SettingsNamespace } from './types';

// ---------- per-namespace default shapes ----------

export interface SocialMeta {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

export interface BrandingSettings {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  welcomeMessage: string | null;
  customDomain: string | null;
  emailFromName: string | null;
  emailFooter: string | null;
  faviconUrl: string | null;
  socialMeta: SocialMeta | null;
}

export interface ScoringSettings {
  weights: {
    commission: number;
    cookieDuration: number;
    payoutSpeed: number;
    programAge: number;
    approvalRate: number;
  };
  threshold: number;
}

export interface GeoSettings {
  additionalRules: Array<{
    category: string;
    blockedCountries: string[];
    reason?: string;
  }>;
  removedRules: Array<{
    category: string;
    country: string;
  }>;
}

export interface CronSettings {
  affiliateScoutCadenceHours: number;
  contentProducerCron: string;
  enabled: {
    affiliateScout: boolean;
    contentProducer: boolean;
  };
}

export interface ChannelTemplate {
  titleTemplate?: string;
  captionTemplate?: string;
  hashtagsTemplate?: string;
  ctaTemplate?: string;
}

export type ChannelProvider = 'youtube' | 'tiktok' | 'instagram' | 'pinterest' | 'linkedin' | 'zalo';

export interface ChannelsSettings {
  defaultPlatforms: string[];
  templates: Partial<Record<ChannelProvider, ChannelTemplate>>;
  preferTemplateOverAI: boolean;
}

export interface McpCustomServer {
  name: string;
  url: string;
  authType: 'none' | 'bearer' | 'header';
  authValue?: string;
  enabled: boolean;
  description?: string;
}

export interface McpSettings {
  enabledServers: string[];
  customEndpoints: Array<{ name: string; url: string }>;
  customServers: McpCustomServer[];
}

export interface WebhooksDefaultsSettings {
  retryCount: number;
  timeoutMs: number;
}

export interface MiscSettings {
  [key: string]: unknown;
}

// ---------- default values ----------

export const DEFAULT_BRANDING: BrandingSettings = {
  logoUrl: null,
  primaryColor: '#7c3aed',
  accentColor: null,
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
  misc: DEFAULT_MISC,
};

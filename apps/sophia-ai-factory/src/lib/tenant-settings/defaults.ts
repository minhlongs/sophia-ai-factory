/**
 * Default values per namespace.
 * Used by registry.getOrDefault() when no row exists for a tenant.
 * @module lib/tenant-settings/defaults
 */

import type { SettingsNamespace } from './types';

// ---------- per-namespace default shapes ----------

export interface BrandingSettings {
  logoUrl: string | null;
  primaryColor: string;
  welcomeMessage: string | null;
  customDomain: string | null;
}

export interface ScoringSettings {
  weights: {
    commission: number;
    conversionRate: number;
    epc: number;
    trustScore: number;
  };
  threshold: number;
}

export interface GeoSettings {
  additionalRules: Array<{
    category: string;
    blockedCountries: string[];
  }>;
}

export interface CronSettings {
  affiliateScoutCadenceHours: number;
  contentProducerCron: string;
}

export interface ChannelsSettings {
  defaultPlatforms: string[];
}

export interface McpSettings {
  enabledServers: string[];
  customEndpoints: Array<{ name: string; url: string }>;
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
  welcomeMessage: null,
  customDomain: null,
};

export const DEFAULT_SCORING: ScoringSettings = {
  weights: {
    commission: 0.4,
    conversionRate: 0.3,
    epc: 0.2,
    trustScore: 0.1,
  },
  threshold: 0.7,
};

export const DEFAULT_GEO: GeoSettings = {
  additionalRules: [],
};

export const DEFAULT_CRON: CronSettings = {
  affiliateScoutCadenceHours: 4,
  contentProducerCron: '0 6 * * *',
};

export const DEFAULT_CHANNELS: ChannelsSettings = {
  defaultPlatforms: [],
};

export const DEFAULT_MCP: McpSettings = {
  enabledServers: [],
  customEndpoints: [],
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

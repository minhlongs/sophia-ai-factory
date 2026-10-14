/**
 * Per-namespace TypeScript interfaces for tenant settings.
 * @module seed/tenant-settings/default-shapes
 */

export interface SocialMeta {
  title: string | null;
  description: string | null;
  imageUrl: string | null;
}

export interface BrandingSettings {
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  agencyName: string | null;
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

export interface StorageSettings {
  r2AccessKeyId: string | null;
  r2SecretAccessKey: string | null;
  r2BucketName: string | null;
  r2Endpoint: string | null;
  r2PublicBaseUrl: string | null;
  useTenantStorage: boolean;
}

export interface MiscSettings {
  [key: string]: unknown;
}

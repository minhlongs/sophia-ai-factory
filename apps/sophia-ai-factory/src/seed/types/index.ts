/**
 * Core type definitions for Sophia AI Video Factory
 */

// Tier system - defines customer subscription levels
export type Tier = "BASIC" | "PREMIUM" | "ENTERPRISE" | "MASTER";
// Tier ranking for comparison (used by resolve-user-tier)
export const TIER_RANK: Record<Tier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};


// Lowercase tier for license key generation
export type TierLowercase = "basic" | "premium" | "enterprise" | "master";

// Feature flags - toggleable features across the application
export type FeatureFlag =
  | "enable_affiliate_engine"
  | "enable_admin_dashboard"
  | "enable_roi_calculator"
  | "enable_api_integrations"
  | "enable_auto_update"
  | "enable_early_access"
  | "enable_ui_redesign";

// User representation (mock for now, will integrate with auth later)
export interface User {
  id: string;
  email: string;
  tier: Tier;
  createdAt: Date;
}

// Tier configuration - defines what each tier can access
export interface TierConfig {
  name: string;
  price: number;
  priceDisplay: string;
  nowpaymentsInvoiceId?: string;
  recommended?: boolean;
  features: FeatureFlag[];
  limits: {
    // Service limits (from tiers.ts)
    youtubeChannels: number;
    videoTemplates: number;
    trainingSessions: number;
    supportMonths: number;
    automationScripts?: boolean;
    affiliateDashboard?: boolean;
    seoOptimization?: boolean;
    monthlyStrategyCalls?: boolean;

    // SaaS limits (optional for now)
    affiliatePrograms?: number;
    monthlyReports?: boolean;
    apiAccess?: boolean;
    support?: "email" | "email-chat" | "priority-24-7";
  };
}

// Affiliate Program - represents a partner program in the discovery engine
export interface AffiliateProgram {
  id: string;
  name: string;
  category: string;
  commission: string;
  commissionType: "recurring" | "one-time" | "hybrid";
  cookieDuration: number; // in days
  payoutTerms: string;
  epc: number; // Earnings Per Click
  link: string;
  description?: string;
  tags?: string[];
  tier?: Tier; // Minimum tier required to access this program
}

// Feature access check result
export interface AccessCheck {
  hasAccess: boolean;
  reason?: string;
  requiredTier?: Tier;
}

// --- Persistence Types (Airtable) ---

export type ScriptStatus = "draft" | "generated" | "approved" | "voice_generating" | "voice_ready" | "video_queued" | "video_generating" | "video_ready" | "published";

export interface ScriptRecord {
  id?: string;
  topic: string;
  content: string;
  status: ScriptStatus;
  tier: Tier;
  userId: string;
  createdAt: string;
  audioUrl?: string;
  videoUrl?: string;
  updatedAt?: string;
}

export interface VideoRecord {
  id?: string;
  scriptId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  platform: "youtube" | "tiktok" | "instagram";
  status: "processing" | "completed" | "failed";
  stats?: {
    views: number;
    likes: number;
    shares: number;
  };
  createdAt: string;
}

// --- One-Time Purchase Types ---

/** Discriminated kind for purchase classification */
export type PurchaseKind = 'subscription' | 'one_time'

/** One-Time SKU identifiers */
export type OneTimeSkuId = 'STARTER_BUNDLE'

/** Purchase status lifecycle */
export type PurchaseStatus = 'pending' | 'paid' | 'refunded' | 'failed'

/** Row shape for user_purchases table */
export interface UserPurchase {
  id: string
  user_id: string
  kind: PurchaseKind
  sku: OneTimeSkuId | string
  payment_id: string
  invoice_id?: string | null
  amount_cents: number
  credits_total: number
  credits_remaining: number
  expires_at?: number | null
  status: PurchaseStatus
  created_at: number
  paid_at?: number | null
  refunded_at?: number | null
  updated_at: number
}

/** One-Time SKU catalog entry */
export interface OneTimeSku {
  id: OneTimeSkuId
  invoiceId: string
  priceUsd: number
  credits: number
  ttlMonths: number
  label_vi: string
  label_en: string
}

// --- Campaign Automation Types (Supabase) ---

export type CampaignStatus = 'draft' | 'queued' | 'processing_script' | 'processing_video' | 'completed' | 'failed';

export interface Campaign {
  id: string;
  user_id: string;
  title: string;
  topic?: string | null;
  audience?: string | null;
  status: CampaignStatus;
  progress: number;
  error_message?: string | null;
  script_content?: Record<string, unknown> | null;
  audio_url?: string | null;
  video_url?: string | null;
  thumbnail_url?: string | null;
  template_id?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Filter for campaign list views
 */
export type CampaignFilter = CampaignStatus | 'all';

// ── Core Primitives ─────────────────────────────────────────────────────────────

export type { Json } from './json';
export type { Database } from './database';

// ── Domain Types ───────────────────────────────────────────────────────────────

// User domain (profiles, sessions, telegram mappings)
export * from './user';

// Affiliate domain (offers, integrations, metrics)
export * from './affiliate';

// Video domain (campaigns, usage, quota tracking)
export * from './video';

// Billing domain (events, dunning, overage, quota limits)
export * from './billing';

// RaaS domain (licenses, API keys, audit logs)
export * from './raas';

// Infrastructure domain (rate limiting, summaries)
export * from './infra';

// ── Cross-layer types (moved from forest/land to seed for layer compliance) ──

export type { AiService, UsageEventInput, UsageEventDB } from './ai-service';
export type { ChannelProvider, PublishStatus, ChannelStatus, PublishMeta, MetricsJson, Publisher } from './channel-provider';
export type { QuotaLimit, QuotaCheckResult, CreditRule, ExportOptions } from './quota-types';
export type { CachedQuota, QuotaCheckContext, QuotaConfig } from './quota-types';
export type {
  PublishingChannel,
  PublishingJob,
  PublishingResult,
} from './publishing-persistence';
export type { VideoGenerateRequestedEvent } from './video-events';
export { D1Events } from './d1-events';
export * from './landing-page-types';

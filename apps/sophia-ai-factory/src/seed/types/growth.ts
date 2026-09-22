/**
 * Growth & Funnel Domain Types
 *
 * Types for omnichannel lead capture, viral video hook generation,
 * multi-platform distribution, UTM attribution, and funnel analytics.
 *
 * @module seed/types/growth
 */

export type ViralNiche = 'ai_automation' | 'ecommerce' | 'solopreneur';

export type HookArchetype =
  | 'curiosity_gap'
  | 'shock_stat'
  | 'direct_question'
  | 'problem_solution'
  | 'contrarian';

export type ViralPlatform =
  | 'tiktok'
  | 'youtube_shorts'
  | 'twitter'
  | 'x'
  | 'facebook_reels'
  | 'instagram_reels';

export interface ViralHook {
  id: string;
  archetype: HookArchetype;
  niche: ViralNiche;
  hookText: string;
  hookTextVi: string;
  estimatedSeconds: number;
  expectedRetentionScore: number; // 1-100
  psychologicalTrigger: string;
  tags: string[];
}

export interface TrendingHook {
  id: string;
  hook: ViralHook;
  viralVelocityScore: number; // 1-100
  trendCategory: string;
  suggestedBroll: string;
  historicalCtrPct: number;
  nicheRelevance: number;
}

export interface ViralScriptSection {
  section: 'hook' | 'problem' | 'solution' | 'proof' | 'cta';
  narration: string;
  narrationVi: string;
  visualCue: string;
  onScreenText: string;
  durationSec: number;
}

export interface ViralScript {
  id: string;
  title: string;
  titleVi: string;
  niche: ViralNiche;
  hookArchetype: HookArchetype;
  hook: ViralHook;
  targetDurationSec: 15 | 30 | 60;
  sections: ViralScriptSection[];
  ctaText: string;
  ctaTextVi: string;
  ctaActionUrl: string;
  telegramDeepLink: string;
  hashtags: string[];
}

export interface FunnelUtmParams {
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term?: string;
  ref?: string;
}

export interface ViralPublishInput {
  videoId: string;
  videoTitle: string;
  videoUrl?: string;
  niche: ViralNiche;
  hookArchetype: HookArchetype;
  scriptText?: string;
  platforms: ViralPlatform[];
  referralCode?: string;
  customTelegramStart?: string;
  scheduledAt?: number;
  byokKeys?: {
    tiktokApiKey?: string;
    youtubeApiKey?: string;
    twitterApiKey?: string;
  };
}

export interface PlatformPublishResult {
  platform: ViralPlatform;
  status: 'published' | 'scheduled' | 'failed' | 'simulated';
  postId?: string;
  postUrl?: string;
  trackedUrl: string;
  telegramDeepLink: string;
  caption: string;
  error?: string;
}

export interface ViralPublishResult {
  videoId: string;
  success: boolean;
  results: Partial<Record<ViralPlatform, PlatformPublishResult>>;
  publishedCount: number;
  failedCount: number;
}

export interface ViralVideoFunnelItem {
  videoId: string;
  videoTitle: string;
  niche: ViralNiche;
  platform: ViralPlatform | 'all';
  hookArchetype: HookArchetype;
  views: number;
  ctaClicks: number;
  ctrPct: number;
  leadsCount: number;
  conversionCount: number;
  revenueUsd: number;
  status: 'active' | 'viral' | 'needs_optimization';
  publishedAt: string;
}

export interface ViralFunnelOverview {
  totalVideos: number;
  totalViews: number;
  totalCtaClicks: number;
  averageCtrPct: number;
  totalLeads: number;
  totalConversions: number;
  totalRevenueUsd: number;
  topPerformingNiche: ViralNiche;
  topPerformingHook: HookArchetype;
  items: ViralVideoFunnelItem[];
}

// ---------------------------------------------------------------------------
// Lead Capture & Qualification Domain Types (R2, R3, R4)
// ---------------------------------------------------------------------------

export type GrowthLeadSource =
  | 'telegram_bot'
  | 'viral_video'
  | 'seo_landing'
  | 'affiliate'
  | 'direct';

export type GrowthLeadStatus =
  | 'new'
  | 'qualified'
  | 'demo_sent'
  | 'checkout_opened'
  | 'converted'
  | 'lost';

export interface GrowthLead {
  id: string;
  source: GrowthLeadSource;
  telegramChatId?: string;
  telegramUsername?: string;
  niche?: string;
  budget?: string;
  leadScore: number; // 0-100
  status: GrowthLeadStatus;
  utmSource?: string;
  utmCampaign?: string;
  affiliatePartnerId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GrowthLeadRow {
  id: string;
  source: string;
  telegram_chat_id: string | null;
  telegram_username: string | null;
  niche: string | null;
  budget: string | null;
  lead_score: number;
  status: string;
  utm_source: string | null;
  utm_campaign: string | null;
  affiliate_partner_id: string | null;
  created_at: number;
  updated_at: number;
}

export type TelegramLeadStatus =
  | 'new'
  | 'qualified'
  | 'demo_sent'
  | 'checkout_sent'
  | 'converted'
  | 'lost';

export interface TelegramLead {
  id: string;
  chatId: string;
  username?: string;
  firstName?: string;
  niche?: string;
  budget?: string;
  qualificationScore: number;
  status: TelegramLeadStatus;
  metadataJson?: string;
  affiliatePartnerId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ViralFunnelLink {
  id: string;
  videoId: string;
  platform: ViralPlatform;
  destinationUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  shortCode?: string;
  clicksCount: number;
  leadsCount: number;
  conversionsCount: number;
  affiliatePartnerId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ViralFunnelLinkRow {
  id: string;
  video_id: string;
  platform: string;
  destination_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  short_code: string | null;
  clicks_count: number;
  leads_count: number;
  conversions_count: number;
  affiliate_partner_id: string | null;
  created_at: number;
  updated_at: number;
}

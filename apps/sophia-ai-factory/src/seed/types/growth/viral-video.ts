/**
 * Growth & Funnel Domain Types — Viral Video & Distribution
 *
 * @module seed/types/growth/viral-video
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

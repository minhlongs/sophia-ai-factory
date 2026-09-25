/**
 * APAC Multi-Platform Automated Syndication & Peak-Time Scheduling Domain Types
 *
 * Types for golden-hour optimization (Hà Nội, Tokyo, Bangkok, Seoul, Singapore),
 * omnichannel distribution (YouTube Shorts, TikTok, Instagram Reels, Facebook Reels),
 * viral metadata generation, and UTM funnel tracking.
 *
 * Layer: Seed (pure types, schemas, and primitives — no upper layer imports)
 *
 * @module seed/types/apac-syndication
 */

import { z } from 'zod';

// ─── Market & Platform Identifiers ──────────────────────────────────────────

export const ApacMarketSchema = z.enum([
  'hanoi',
  'tokyo',
  'bangkok',
  'seoul',
  'singapore',
]);
export type ApacMarket = z.infer<typeof ApacMarketSchema>;

export const PlatformTypeSchema = z.enum([
  'youtube_shorts',
  'tiktok',
  'instagram_reels',
  'facebook_reels',
]);
export type PlatformType = z.infer<typeof PlatformTypeSchema>;

export const ApacLanguageSchema = z.enum(['vi', 'en', 'ja', 'ko', 'th']);
export type ApacLanguage = z.infer<typeof ApacLanguageSchema>;

export const ViralHookArchetypeSchema = z.enum([
  'curiosity_gap',
  'shock_stat',
  'direct_question',
  'problem_solution',
  'contrarian',
]);
export type ViralHookArchetype = z.infer<typeof ViralHookArchetypeSchema>;

// ─── Golden-Hour Scheduling Types ───────────────────────────────────────────

export interface PeakTimeSlot {
  hour: number;
  minute: number;
  name: string;
}

export interface MarketPeakConfig {
  market: ApacMarket;
  timezone: string;
  utcOffsetHours: number;
  slots: PeakTimeSlot[];
  displayName: string;
}

export interface PeakSlotResult {
  scheduledAtMs: number;
  slotName: string;
  timeZone: string;
  market: ApacMarket;
  localTimeFormatted: string;
  isRollover: boolean;
}

export interface PublishingScheduleInput {
  videoId: string;
  channels: string[];
  market: ApacMarket;
  userRequestedTime?: number;
  caption?: string;
  hashtags?: string[];
  productLink?: string;
  audienceTimezone?: string;
  staggerMinutes?: number;
}

// ─── Viral Metadata Types ───────────────────────────────────────────────────

export interface ThumbnailPromptSpec {
  aspectRatio: '9:16';
  layout: string;
  headlineText: string;
  colorPalette: string[];
  visualFocus: string;
  lighting: string;
  prompt: string;
}

export interface ViralMetadataInput {
  topic: string;
  niche: 'ai_automation' | 'ecommerce' | 'solopreneur' | string;
  targetPlatform: PlatformType;
  targetLanguage: ApacLanguage;
  targetMarket?: ApacMarket;
  hookArchetype?: ViralHookArchetype;
  keyTakeaways?: string[];
  referralCode?: string;
  customTelegramStart?: string;
  funnelBaseUrl?: string;
  videoJobId?: string;
}

export interface ViralMetadataResult {
  hookTitle: string;
  seoDescription: string;
  hashtags: string[];
  thumbnailPrompt: string;
  thumbnailSpec: ThumbnailPromptSpec;
  trackedFunnelUrl: string;
  telegramDeepLink: string;
  platform: PlatformType;
  language: ApacLanguage;
  targetMarket?: ApacMarket;
  charCount: {
    title: number;
    description: number;
  };
  isCompliant: boolean;
}

/**
 * Backward compatibility alias for M3 (Syndication) ↔ Scheduler & Publishers contract
 */
export type ViralMetadata = ViralMetadataResult;

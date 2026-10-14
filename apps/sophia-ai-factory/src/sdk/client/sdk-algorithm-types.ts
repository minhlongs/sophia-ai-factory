/**
 * Sophia Client SDK Algorithm, Publishing, and Channel Registration Types.
 * @module sdk/client/sdk-algorithm-types
 */

export interface AffiliateDescriptionOptions {
  niche?: string;
  max?: number;
}

export interface AffiliateDescription {
  description: string;
  affiliateCount: number;
}

export interface TranslateInput {
  text: string;
  fromLang: string;
  toLang: string;
  tone?: 'literal' | 'natural';
}

export interface TranslateResult {
  translated: string;
  model: string;
}

export interface VoiceCloneInput {
  name: string;
  audioUrls: string[];
  description?: string;
}

export interface VoiceCloneResult {
  voiceId: string;
  samplesUploaded: number;
}

export interface SeoScriptInput {
  topic: string;
  keywords?: string[];
  language?: 'en' | 'vi';
}

export interface SeoScriptResult {
  script: string;
  seoScore: number;
  suggestedTitles: string[];
  keywordCoverage: Array<{ keyword: string; hits: number }>;
}

export interface LiveStats {
  missionsCompleted: number;
  paidAgencies: number;
  videosGenerated: number;
  generatedAt: number;
}

export interface PublishScheduleInput {
  videoId: string;
  channelId: string;
  scheduledAt: number;
  caption?: string;
  hashtags?: string[];
}

export interface PublishScheduleResult {
  jobId: string;
  scheduledAt: number;
  status: 'scheduled';
}

export type PublishProvider =
  | 'tiktok'
  | 'youtube'
  | 'instagram'
  | 'facebook'
  | 'twitter'
  | 'linkedin'
  | 'pinterest'
  | 'threads'
  | 'reddit'
  | 'bluesky'
  | 'mastodon'
  | 'zalo'
  | 'whatsapp';

export interface RegisterChannelInput {
  provider: PublishProvider;
  externalAccountId: string;
  accessToken: string;
  refreshToken?: string;
}

export interface RegisterChannelResult {
  channelId: string;
  provider: string;
  status: 'active';
}

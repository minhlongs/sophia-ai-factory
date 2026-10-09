/**
 * Types and interfaces part of the TypeScript SDK template
 *
 * Layer: app/api/sdk/typescript
 */

export const SDK_TYPES_PART = `/**
 * Sophia AI Factory SDK — auto-generated single-file client.
 * Source of truth: https://sophia.agencyos.network/api/sdk/typescript
 */

export interface SophiaClientOptions {
  apiKey?: string;
  token?: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export type SophiaToken = string;

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class SophiaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'SophiaApiError';
  }
}

export interface Mission {
  id: string;
  command: string;
  params: Record<string, unknown> | null;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  result: Record<string, unknown> | null;
  error: string | null;
  credits_used: number;
  credits_required?: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  webhook_url: string | null;
  webhook_fired_at: number | null;
  eta_seconds?: number;
  stream_url?: string;
}

export interface CreateMissionOptions {
  command: string;
  params?: Record<string, unknown>;
  webhook_url?: string;
}

export interface ListMissionsOptions {
  status?: string;
  command?: string;
  limit?: number;
  cursor?: string;
}

export interface PaginatedMissions {
  missions: Mission[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface MissionEvent {
  event: string;
  data: Record<string, unknown>;
}

export interface McuBalance {
  credits_remaining: number;
  credits_total_purchased: number;
  credits_total_used: number;
  recent_transactions?: unknown[];
}

export interface ConsumeCreditsOptions {
  amount: number;
  reason?: string;
  missionId?: string;
}

export interface ConsumeCreditsResult {
  success: boolean;
  credits_remaining: number;
  credits_consumed: number;
  transaction_id?: string;
}

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
`;

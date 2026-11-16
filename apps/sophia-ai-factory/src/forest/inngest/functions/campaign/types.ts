import type { Tier, CampaignStatus } from '@/seed/types';
import type { PipelineStep } from '@/tree/gateway/pipeline-step-navigator';

export interface CampaignCreatedEventData {
  campaignId: string;
  userId: string;
  topic: string;
  audience: string;
  tier: Tier;
  resume?: boolean;
  resumeFrom?: string;
  abExperimentId?: string;
}

export interface AffiliateOfferSelectedRow {
  short_code: string;
  offer_id?: string | null;
  offer_name: string;
  affiliate_link: string;
  network?: string | null;
  category?: string | null;
}

export interface AffiliateOfferResult {
  productName: string;
  shortUrl: string;
  category?: string | null;
  network?: string | null;
}

export interface VideoAssets {
  video_url: string;
  thumbnail_url: string;
}

export interface DistributionResult {
  allSucceeded: boolean;
  results: Array<{ channelId: string; success: boolean }>;
}

export interface StepContext {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
}

export type StatusUpdater = (
  status: CampaignStatus,
  progress: number,
  data?: Record<string, unknown>,
) => Promise<void>;

export type UserNotifier = (message: string) => Promise<void>;

export type ProviderErrorNotifier = (
  userId: string,
  campaignId: string,
  provider: string,
  type: 'quota' | 'key',
  rawError: string,
) => Promise<void>;

export type StepCheckpointer = (stepName: PipelineStep) => Promise<void>;

/**
 * Core interfaces for the multi-channel publisher pipeline.
 *
 * Base types: @/seed/types/channel-provider
 * D1 row types: defined here (forest-specific persistence shapes).
 */
import type { ChannelProvider, PublishStatus, ChannelStatus, PublishMeta, MetricsJson, Publisher } from '@/seed/types/channel-provider';

export { ChannelProvider, PublishStatus, ChannelStatus, PublishMeta, MetricsJson, Publisher };

/** D1 row for publishing_channels table */
export interface PublishingChannel {
  id: string;
  tenant_id: string;
  user_id: string;
  provider: ChannelProvider;
  external_account_id: string;
  display_name: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
  status: ChannelStatus;
  refreshing_at: number | null;
  created_at: number;
  updated_at: number;
}

/** D1 row for publishing_jobs table */
export interface PublishingJob {
  id: string;
  tenant_id: string;
  /** FK to videos.id (renamed from video_job_id in Wave 20 Phase 05). */
  video_id: string;
  channel_id: string;
  provider: ChannelProvider;
  status: PublishStatus;
  caption: string;
  hashtags_json: string | null;
  title: string | null;
  product_link: string | null;
  scheduled_at: number | null;
  retry_count: number;
  created_at: number;
  updated_at: number;
}

/** D1 row for publishing_results table — matches 20260503_publishing.sql (C2) */
export interface PublishingResult {
  id: string;
  publishing_job_id: string;
  tenant_id: string;
  channel_post_id: string;
  post_url: string | null;
  metrics_json: string | null;
  published_at: number;
}

/**
 * Publishing persistence types — D1 row shapes for the publishing pipeline
 *
 * These types represent the exact schema of the publishing_* tables.
 * They are kept in seed/types so that both forest and land can import
 * them without cross-layer dependency violations.
 */

import type { ChannelProvider, PublishStatus, ChannelStatus } from './channel-provider';

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
  /** FK to videos.id or engine_missions.id */
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

/** D1 row for publishing_results table */
export interface PublishingResult {
  id: string;
  publishing_job_id: string;
  tenant_id: string;
  channel_post_id: string;
  post_url: string | null;
  metrics_json: string | null;
  published_at: number;
}

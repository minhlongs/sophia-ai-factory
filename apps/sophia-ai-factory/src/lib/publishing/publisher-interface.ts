/**
 * Core interfaces for the multi-channel publisher pipeline.
 * All channel adapters implement the Publisher interface.
 */

export type ChannelProvider = 'tiktok' | 'youtube' | 'instagram';
export type PublishStatus = 'scheduled' | 'uploading' | 'processing' | 'live' | 'failed';

export interface PublishMeta {
  caption: string;
  hashtags: string[];
  title?: string;
  productLink?: string;
}

export interface MetricsJson {
  views: number;
  likes: number;
  comments?: number;
  shares?: number;
  reach?: number;
  [key: string]: number | string | undefined;
}

export interface Publisher {
  upload(videoUrl: string, meta: PublishMeta): Promise<string>;
  pollStatus(externalPostId: string): Promise<PublishStatus>;
  getMetrics(externalPostId: string): Promise<MetricsJson>;
}

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
  status: 'active' | 'disconnected' | 'expired';
  created_at: number;
  updated_at: number;
}

/** D1 row for publishing_jobs table */
export interface PublishingJob {
  id: string;
  tenant_id: string;
  video_job_id: string;
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
  channel_post_id: string;
  post_url: string | null;
  metrics_json: string | null;
  published_at: number;
}

export interface InstagramReelsMetrics {
  views: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
}

export interface HarvestInstagramOptions {
  limit?: number;
  dateRangeDays?: number;
  fetchMetrics?: (accessToken: string, mediaId: string) => Promise<InstagramReelsMetrics>;
}

export interface HarvestResult {
  totalFound: number;
  harvested: number;
  errors: number;
}

export interface InstagramPostRow {
  tenant_id: string;
  video_id: string;
  channel_post_id: string;
  channel_id?: string;
  access_token?: string;
  external_account_id?: string;
  expires_at?: number;
}

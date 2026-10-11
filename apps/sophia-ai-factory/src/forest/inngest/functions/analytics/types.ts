export interface PublishedVideoRow {
  user_id: string;
  video_id: string;
  platform_video_id: string;
  platform: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export interface UserSyncResult {
  count: number;
  revenueWritten: number;
}

export interface AnalyticsSyncSummary {
  [key: string]: unknown;
  synced: number;
  optimizedCount: number;
  revenueEvents: number;
  instagramHarvested?: number;
}

/**
 * Market Signals Ingest Cron Types and Config
 * Layer: forest/inngest/functions/market-signals
 */

export interface WorkspaceSourceConfigRow {
  workspace_id: string;
  source: string; // 'youtube' | 'google-trends-rss'
  config_json: string; // JSON with regionCode, userId (for youtube), maxSignals, etc.
}

export interface SourceFetchConfig {
  workspaceId: string;
  userId?: string; // Required for YouTube BYOK
  regionCode?: string;
  categoryId?: string;
  maxSignals?: number;
}

export const DEFAULT_MAX_SIGNALS = 25;
export const DEFAULT_REGION = 'US';

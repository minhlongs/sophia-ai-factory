export const CRON_NAME = 'video-status-sync';
export const TERMINAL = new Set<string>(['completed', 'failed', 'failed_permanent']);
/** Timeout: mark as permanently failed after 24 h */
export const TIMEOUT_MS = 24 * 60 * 60 * 1000;
export const CONCURRENCY_LIMIT = 5;

export interface VideoRow {
  id: string;
  user_id: string;
  heygen_job_id: string;
  created_at: string;
  /** Nullable — present for one-time bundle videos */
  purchase_id?: string | null;
  /** Locale for email templates */
  locale?: string | null;
  /** R2 object key — set when video was already stored to R2 before failure */
  r2_key?: string | null;
}

export interface SyncSummary {
  checked: number;
  terminal: number;
  timedOut: number;
  errors: number;
}

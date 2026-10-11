export const CRON_NAME = 'fulfillment-retry';
export const BATCH_LIMIT = 20;
/** Every-2-min cron — skip if ran within last 90 seconds (prevents duplicate runs on retry storms) */
export const IDEMPOTENCY_WINDOW_MS = 90 * 1000;

export interface UserEmailRow {
  email?: string;
  locale?: string;
}

export interface RetrySummary {
  retried: number;
  succeeded: number;
  failed: number;
  permanent: number;
  skipped: number;
  circuitBlocked: number;
}

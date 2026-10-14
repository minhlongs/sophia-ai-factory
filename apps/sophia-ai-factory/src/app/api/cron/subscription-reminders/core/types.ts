export const CRON_NAME = 'subscription-reminders';
/** Daily — skip if ran within last 12 hours */
export const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

/** Days before expiry at which to send reminders */
export const REMINDER_DAYS = [7, 3] as const;

export interface SubscriptionRow {
  org_id: string;
  plan: string;
  status: string;
  current_period_end: string | null;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
}

export interface BillingEventRow {
  org_id: string;
  event_type: string;
}

export interface ReminderProcessOutcome {
  success: boolean;
  sent: boolean;
}

export interface WindowProcessResult {
  sent: number;
  errors: number;
}

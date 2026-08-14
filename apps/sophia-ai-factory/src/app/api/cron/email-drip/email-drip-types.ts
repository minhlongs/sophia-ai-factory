/**
 * Shared types for the email-drip cron handler.
 * @module app/api/cron/email-drip/email-drip-types
 */

export interface HandoverRow {
  id: string;
  customer_user_id: string;
  created_at: number;
  customer_first_login_at: number | null;
  customer_first_sop_install_at: number | null;
  agency_name: string;
  trigger_payment_id: string | null;
  source: string;
}

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
}

export interface AffiliateEnrollmentRow {
  user_id: string;
  code: string;
  /** SQLite datetime('now') string — needs Date.parse to ms. */
  created_at: string;
}

export interface ActivationCandidateRow {
  id: string;
  email: string;
  name: string | null;
  /** SQLite datetime('now') string. */
  createdAt: string;
  /** Min(session.createdAt) — null if user never logged in. */
  first_login_at: string | null;
  /** Min(video_jobs.created_at) — unix seconds, null if no video. */
  first_video_at: number | null;
}

export interface CancelledSubscriptionRow {
  user_id: string;
  email: string;
  name: string | null;
  /** SQLite datetime — subscription updated_at. */
  updated_at: string;
}

export interface FirstVideoCandidateRow {
  user_id: string;
  email: string;
  name: string | null;
  /** Unix seconds — earliest video created_at for this user. */
  first_video_at: number;
}

export interface ReEngagementCandidateRow {
  id: string;
  email: string;
  name: string | null;
  /** SQLite datetime('now') string. */
  createdAt: string;
  last_login_at: string | null;
  /** Unix seconds. */
  last_video_at: number | null;
  /** Latest subscription status; null if user never subscribed. */
  sub_status: string | null;
}

export interface PostPurchaseCandidateRow {
  user_id: string;
  email: string;
  name: string | null;
  purchased_at: number;
  onboarding_completed_at: string | null;
  plan: string;
}

export interface EmailDecision {
  template: string;
  payload: Record<string, unknown>;
}

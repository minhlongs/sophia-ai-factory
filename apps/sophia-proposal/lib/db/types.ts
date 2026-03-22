/**
 * D1 Table Types
 *
 * TypeScript interfaces matching the D1/SQLite schema.
 * Use these as generics: db.from<User>('users').select(...)
 */

// ── Auth & Users ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string | null;
  created_at: string;
  updated_at: string;
}

// ── Organizations ─────────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  slug: string | null;
  plan: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  created_at: string;
}

// ── Billing ───────────────────────────────────────────────────────────────────

export interface OrgBalance {
  org_id: string;
  balance: number;
  lifetime_credits: number;
  lifetime_used: number;
  updated_at: string;
}

export interface Subscription {
  id: string;
  org_id: string;
  tier_name: string;
  status: string;
  mcu_monthly: number;
  polar_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingSettings {
  id: string;
  org_id: string;
  polar_customer_id: string | null;
  polar_subscription_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  org_id: string;
  amount: number;
  type: 'debit' | 'credit';
  description: string | null;
  created_at: string;
}

// ── Missions ──────────────────────────────────────────────────────────────────

export interface Mission {
  id: string;
  org_id: string;
  title: string;
  command: string;
  params: Record<string, unknown>;
  status: string;
  priority: string;
  mcu_cost: number;
  mcu_reserved: number;
  result: Record<string, unknown> | null;
  error_message: string | null;
  webhook_url: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionTemplate {
  id: string;
  command: string;
  name: string;
  description: string | null;
  mcu_cost: number;
  is_active: boolean;
  created_at: string;
}

// ── Proposals ─────────────────────────────────────────────────────────────────

export interface Proposal {
  id: string;
  org_id: string;
  title: string;
  status: string;
  content: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ── Usage ─────────────────────────────────────────────────────────────────────

export interface UsageLog {
  id: string;
  org_id: string;
  feature: string;
  mcu_cost: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Video ─────────────────────────────────────────────────────────────────────

export interface VideoAsset {
  id: string;
  org_id: string;
  title: string;
  status: string;
  heygen_video_id: string | null;
  video_url: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  mcu_cost: number;
  video_type: string | null;
  error_message: string | null;
  ready_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Referral ──────────────────────────────────────────────────────────────────

export interface ReferralCode {
  id: string;
  org_id: string;
  code: string;
  uses: number;
  max_uses: number | null;
  reward_mcu: number;
  is_active: boolean;
  created_at: string;
}

export interface ReferralEvent {
  id: string;
  referral_code_id: string;
  referred_org_id: string | null;
  event_type: string;
  created_at: string;
}

// ── Affiliate ─────────────────────────────────────────────────────────────────

export interface AffiliatePayout {
  id: string;
  org_id: string;
  amount: number;
  currency: string;
  status: string;
  period_month: string | null;
  created_at: string;
}

export interface AffiliateClick {
  id: string;
  content_id: string | null;
  program_id: string;
  ip_hash: string | null;
  user_agent: string | null;
  referrer: string | null;
  country: string | null;
  created_at: string;
}

// ── CRM ───────────────────────────────────────────────────────────────────────

export interface CrmSettings {
  id: string;
  org_id: string;
  provider: string;
  access_token: string | null;
  refresh_token: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ── Onboarding ────────────────────────────────────────────────────────────────

export interface OnboardingCall {
  id: string;
  org_id: string;
  scheduled_at: string | null;
  status: string;
  created_at: string;
}

// ── API Keys ──────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  org_id: string;
  key_hash: string;
  name: string;
  permissions: string[];
  rate_limit: number;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

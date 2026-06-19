/**
 * Billing Domain Types
 *
 * Database row types for billing events, dunning, overage, quota limits.
 * Extracted from supabase-types.ts for modular organization.
 *
 * @module seed/types/billing
 */

import { Json } from './json';

// Billing events ledger (detailed payment/billing lifecycle)
export interface BillingEventRow {
  id: string;
  user_id: string;
  license_nonce: string;
  event_type: string;
  event_category: string;
  event_data: Json;
  amount: number | null;
  currency: string;
  payment_provider: string | null;
  provider_event_id: string | null;
  provider_invoice_id: string | null;
  provider_charge_id: string | null;
  email_sent: boolean;
  email_template: string | null;
  email_recipient: string | null;
  email_sent_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  processed: boolean;
  processed_at: string | null;
}

export interface BillingEventInsert {
  user_id: string;
  license_nonce: string;
  event_type: string;
  event_category: string;
  event_data?: Json;
  amount?: number | null;
  currency?: string;
  payment_provider?: string | null;
  provider_event_id?: string | null;
  provider_invoice_id?: string | null;
  provider_charge_id?: string | null;
  email_sent?: boolean;
  email_template?: string | null;
  email_recipient?: string | null;
  email_sent_at?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string;
  processed?: boolean;
  processed_at?: string | null;
}

// Dunning state machine
export type DunningState = 'current' | 'past_due' | 'delinquent' | 'suspended';

export interface DunningSettingsRow {
  id: string;
  user_id: string;
  license_nonce: string;
  stripe_customer_id: string | null;
  grace_period_days: number;
  max_retry_attempts: number;
  retry_schedule: string[];
  send_email_notifications: boolean;
  email_language: string;
  dunning_state: DunningState;
  dunning_state_changed_at: string;
  created_at: string;
  updated_at: string;
}

export interface DunningSettingsInsert {
  user_id: string;
  license_nonce: string;
  stripe_customer_id?: string | null;
  grace_period_days?: number;
  max_retry_attempts?: number;
  retry_schedule?: string[];
  send_email_notifications?: boolean;
  email_language?: string;
  dunning_state?: DunningState;
  created_at?: string;
  updated_at?: string;
}

export interface DunningSettingsUpdate {
  grace_period_days?: number;
  max_retry_attempts?: number;
  retry_schedule?: string[];
  send_email_notifications?: boolean;
  email_language?: string;
  dunning_state?: DunningState;
  updated_at?: string;
}

// Dunning attempt tracking
export interface DunningAttemptRow {
  id: string;
  user_id: string;
  license_nonce: string;
  attempt_number: number;
  attempt_type: string;
  payment_provider: string;
  success: boolean;
  amount: number | null;
  currency: string;
  failure_reason: string | null;
  provider_response_id: string | null;
  dunning_state_before: DunningState | null;
  dunning_state_after: DunningState | null;
  next_retry_at: string | null;
  scheduled_retry_count: number;
  stripe_invoice_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface DunningAttemptInsert {
  user_id: string;
  license_nonce: string;
  attempt_number?: number;
  attempt_type: string;
  payment_provider: string;
  success?: boolean;
  amount?: number | null;
  currency?: string;
  failure_reason?: string | null;
  provider_response_id?: string | null;
  dunning_state_before?: DunningState | null;
  dunning_state_after?: DunningState | null;
  next_retry_at?: string | null;
  scheduled_retry_count?: number;
  stripe_invoice_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string;
}

export interface DunningAttemptUpdate {
  success?: boolean;
  failure_reason?: string | null;
}

// Overage events (usage beyond quota)
export interface OverageEventRow {
  id: string;
  user_id: string;
  license_nonce: string;
  exceeded_type: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  exceeded_limit: number;
  exceeded_current: number;
  exceeded_by: number;
  requested_credits: number;
  endpoint: string | null;
  service_name: string | null;
  action: string | null;
  tier_at_exceeded: string;
  external_customer_id: string | null;
  billable: boolean;
  ip_address: string | null;
  user_agent: string | null;
  created_at: number;
}

export interface OverageEventInsert {
  user_id: string;
  license_nonce: string;
  exceeded_type: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests';
  exceeded_limit: number;
  exceeded_current: number;
  exceeded_by: number;
  requested_credits?: number;
  endpoint?: string | null;
  service_name?: string | null;
  action?: string | null;
  tier_at_exceeded: string;
  external_customer_id?: string | null;
  billable?: boolean;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: number;
}

// Quota limits configuration (per-license overrides)
export interface QuotaLimitRow {
  id: string;
  license_nonce: string;
  custom_daily_credits: number | null;
  custom_hourly_credits: number | null;
  custom_monthly_credits: number | null;
  custom_daily_requests: number | null;
  overage_allowed: boolean;
  overage_price_per_credit: number | null;
  overage_hard_limit: number | null;
  soft_warning_threshold: number;
  hard_block_threshold: number;
  created_at: number;
  updated_at: number | null;
  created_by: string | null;
}

export interface QuotaLimitInsert {
  license_nonce: string;
  custom_daily_credits?: number | null;
  custom_hourly_credits?: number | null;
  custom_monthly_credits?: number | null;
  custom_daily_requests?: number | null;
  overage_allowed?: boolean;
  overage_price_per_credit?: number | null;
  overage_hard_limit?: number | null;
  soft_warning_threshold?: number;
  hard_block_threshold?: number;
  created_at?: number;
  updated_at?: number | null;
  created_by?: string | null;
}

export interface QuotaLimitUpdate {
  custom_daily_credits?: number | null;
  custom_hourly_credits?: number | null;
  custom_monthly_credits?: number | null;
  custom_daily_requests?: number | null;
  overage_allowed?: boolean;
  overage_price_per_credit?: number | null;
  overage_hard_limit?: number | null;
  soft_warning_threshold?: number;
  hard_block_threshold?: number;
  updated_at?: number;
}

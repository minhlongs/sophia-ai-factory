/**
 * Dunning State Machine and Attempt Tracking Types
 *
 * Layer: seed/types/billing
 */

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

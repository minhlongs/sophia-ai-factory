/**
 * Overage and Quota Limit Row and Mutation Types
 *
 * Layer: seed/types/billing
 */

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

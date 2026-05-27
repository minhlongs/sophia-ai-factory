export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface AffiliateProductRow {
  id: string
  external_id: string
  network_id: 'clickbank' | 'shareasale' | 'amazon'
  title: string
  description: string | null
  affiliate_link: string
  thumbnail_url: string | null
  price_usd: number | null
  commission_rate: number | null
  avg_earnings_usd: number | null
  raw_metrics: Json
  sps_score: number | null
  is_hidden_gem: boolean
  category_id: number | null
  created_at: string
  updated_at: string
}

export interface AffiliateMetricHistoryRow {
  id: string
  product_id: string
  recorded_at: string
  metric_type: string
  value: number
}

export interface AffiliateCategoryRow {
  id: number
  name: string
  slug: string
  parent_id: number | null
}

export interface UserIntegrationRow {
  id: string
  user_id: string
  network_id: 'clickbank' | 'shareasale' | 'amazon'
  api_key: string
  api_secret: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserProfileRow {
  user_id: string
  telegram_chat_id: string | null
  settings: Json | null
  api_keys: Json | null
  subscription_tier: 'free' | 'pro' | 'enterprise' | 'basic' | 'premium' | null
  subscription_status: string | null
  subscription_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface UserProfileInsert {
  user_id: string
  telegram_chat_id?: string | null
  settings?: Json | null
  api_keys?: Json | null
  subscription_tier?: 'free' | 'pro' | 'enterprise' | 'basic' | 'premium' | null
  subscription_status?: string | null
  subscription_expires_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface UserSessionRow {
  id?: string
  telegram_chat_id: string
  state: string
  context_data: Json
  last_event?: string | null
  subscription_tier?: string | null
  auth_cache?: Json
  expires_at?: string | null
  updated_at: string
  created_at?: string
}

export interface UsageEventRow {
  id?: string
  user_id: string
  license_key_hash: string
  license_nonce: string
  service_name: string
  endpoint: string
  action: string
  tokens_input: number
  tokens_output: number
  credits_used: number
  request_id: string | null
  model_name: string | null
  tier_at_request: string
  status_code: number | null
  error_message: string | null
  response_time_ms: number | null
  created_at: number
  idempotency_key: string | null
  external_customer_id: string | null
  resource_type: string | null
}

export interface UsageEventInsert {
  user_id: string
  license_key_hash: string
  license_nonce: string
  service_name: string
  endpoint: string
  action: string
  tokens_input?: number
  tokens_output?: number
  credits_used: number
  request_id?: string | null
  model_name?: string | null
  tier_at_request: string
  status_code?: number | null
  error_message?: string | null
  response_time_ms?: number | null
  created_at?: number
  idempotency_key?: string | null
  external_customer_id?: string | null
  resource_type?: string | null
}

export interface RateLimitRow {
  id?: string
  identifier: string
  window_start: string
  request_count: number
  created_at?: string
}

export interface TelegramRateLimitRow {
  id?: string
  telegram_chat_id: string
  command_timestamp: string
  command_type?: string | null
  created_at?: string
}

export interface TelegramUserMappingRow {
  id?: string
  telegram_chat_id: string
  user_id: string
  subscription_tier?: string | null
  created_at?: string
  updated_at?: string
}

// ============================================================================
// RaaS License Management Tables
// ============================================================================

export interface RaasLicenseRow {
  id: string
  key_hash: string
  tier: string
  expires_at: number | null
  nonce: string
  is_revoked: boolean
  revoked_at: number | null
  revoked_by: string | null
  created_by: string | null
  created_at: number
  metadata: Json
  updated_at: number | null
  stripe_customer_id: string | null
}

export interface RaasLicenseInsert {
  key_hash: string
  tier: string
  expires_at?: number | null
  nonce: string
  is_revoked?: boolean
  revoked_at?: number | null
  revoked_by?: string | null
  created_by?: string | null
  created_at?: number
  metadata?: Json
}

export interface RaasLicenseUpdate {
  key_hash?: string
  tier?: string
  expires_at?: number | null
  nonce?: string
  is_revoked?: boolean
  revoked_at?: number | null
  revoked_by?: string | null
  created_by?: string | null
  metadata?: Json
  stripe_customer_id?: string | null
  [key: string]: string | number | boolean | Json | null | undefined
}

// ============================================================================
// Usage Metering Summary Tables
// ============================================================================

export interface UsageHourlySummaryRow {
  id?: string
  hour_timestamp: number
  tenant_id: string
  license_nonce: string
  external_customer_id: string | null
  total_requests: number
  total_credits: number
  total_tokens_input: number
  total_tokens_output: number
  total_errors: number
  avg_response_time_ms: number
  service_breakdown: Json
  created_at?: string
  updated_at?: string
}

export interface UsageHourlySummaryInsert {
  hour_timestamp: number
  tenant_id: string
  license_nonce: string
  external_customer_id?: string | null
  total_requests?: number
  total_credits?: number
  total_tokens_input?: number
  total_tokens_output?: number
  total_errors?: number
  avg_response_time_ms?: number
  service_breakdown?: Json
}

export interface UsageDailySummaryRow {
  id?: string
  day_timestamp: number
  tenant_id: string
  license_nonce: string
  external_customer_id: string | null
  total_requests: number
  total_credits: number
  total_tokens_input: number
  total_tokens_output: number
  total_errors: number
  avg_response_time_ms: number
  hourly_breakdown: Json
  service_breakdown: Json
  created_at?: string
  updated_at?: string
}

export interface UsageDailySummaryInsert {
  day_timestamp: number
  tenant_id: string
  license_nonce: string
  external_customer_id?: string | null
  total_requests?: number
  total_credits?: number
  total_tokens_input?: number
  total_tokens_output?: number
  total_errors?: number
  avg_response_time_ms?: number
  hourly_breakdown?: Json
  service_breakdown?: Json
}

export interface UsageQuotaUsageRow {
  id?: string
  window_type: 'hourly' | 'daily' | 'monthly'
  window_start: number
  window_end: number
  tenant_id: string
  license_nonce: string
  tier: string
  credits_used: number
  requests_used: number
  credit_limit: number
  request_limit: number
  created_at?: string
}

export interface UsageQuotaUsageInsert {
  window_type: 'hourly' | 'daily' | 'monthly'
  window_start: number
  window_end: number
  tenant_id: string
  license_nonce: string
  tier: string
  credits_used?: number
  requests_used?: number
  credit_limit: number
  request_limit: number
}

export interface RaasAuditLogRow {
  id: string
  action: string
  license_id: string | null
  license_nonce: string | null
  user_id: string | null
  ip_address: string | null
  user_agent: string | null
  details: Json
  created_at: number
  // Hash chain fields for immutable audit trail
  content_hash: string
  previous_log_hash: string | null
  hash_chain_valid: boolean
  // Usage tracking fields (Phase 6 Advanced Audit Logging)
  model_name: string | null
  token_count: number | null
  ip_address_hash: string | null
  user_pseudonym: string | null
}

export interface RaasAuditLogInsert {
  action: string
  license_id?: string | null
  license_nonce?: string | null
  user_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  details?: Json
  created_at?: number
  // Usage tracking fields (optional on insert)
  model_name?: string | null
  token_count?: number | null
  ip_address_hash?: string | null
  user_pseudonym?: string | null
  // Note: content_hash, previous_log_hash, hash_chain_valid are auto-computed by trigger
}

export interface CampaignRow {
  id: string
  user_id: string
  title: string
  topic: string | null
  audience: string | null
  status: 'draft' | 'queued' | 'processing_script' | 'processing_video' | 'completed' | 'failed'
  progress: number | null
  error_message: string | null
  script_content: Json | null
  video_url: string | null
  thumbnail_url: string | null
  template_id: string | null
  audio_url: string | null
  created_at: string
  updated_at: string
}

export interface CampaignTemplateRow {
  id: string
  name: string
  description: string
  category: string
  icon: string
  defaults: Json
  is_predefined: boolean
  user_id: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      affiliate_products: {
        Row: AffiliateProductRow
        Insert: Omit<AffiliateProductRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<AffiliateProductRow>
        Relationships: []
      }
      affiliate_metric_history: {
        Row: AffiliateMetricHistoryRow
        Insert: Omit<AffiliateMetricHistoryRow, 'id' | 'recorded_at'>
        Update: Partial<AffiliateMetricHistoryRow>
        Relationships: []
      }
      affiliate_categories: {
        Row: AffiliateCategoryRow
        Insert: Omit<AffiliateCategoryRow, 'id'>
        Update: Partial<AffiliateCategoryRow>
        Relationships: []
      }
      user_integrations: {
        Row: UserIntegrationRow
        Insert: Omit<UserIntegrationRow, 'id' | 'created_at' | 'updated_at' | 'is_active'> & { is_active?: boolean, created_at?: string, updated_at?: string }
        Update: Partial<UserIntegrationRow>
        Relationships: []
      }
      user_profiles: {
        Row: UserProfileRow
        Insert: UserProfileInsert
        Update: Partial<UserProfileRow>
        Relationships: []
      }
      campaigns: {
        Row: CampaignRow
        Insert: Omit<CampaignRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'progress'> & {
            status?: 'draft' | 'queued' | 'processing_script' | 'processing_video' | 'completed' | 'failed'
            progress?: number
        }
        Update: Partial<CampaignRow>
        Relationships: []
      }
      campaign_templates: {
        Row: CampaignTemplateRow
        Insert: {
          id: string
          name: string
          description: string
          category: string
          icon?: string
          defaults: Json
          is_predefined?: boolean
          user_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<CampaignTemplateRow>
        Relationships: []
      }
      payment_events: {
        Row: {
          id: string
          event_type: string
          provider_event_id: string
          payload: Json
          processed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          provider_event_id: string
          payload: Json
          processed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          provider_event_id?: string
          payload?: Json
          processed?: boolean
          created_at?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: UserSessionRow
        Insert: Omit<UserSessionRow, 'id' | 'created_at'>
        Update: Partial<UserSessionRow>
        Relationships: []
      }
      rate_limits: {
        Row: RateLimitRow
        Insert: Omit<RateLimitRow, 'id' | 'created_at'>
        Update: Partial<RateLimitRow>
        Relationships: []
      }
      telegram_rate_limits: {
        Row: TelegramRateLimitRow
        Insert: Omit<TelegramRateLimitRow, 'id' | 'created_at'>
        Update: Partial<TelegramRateLimitRow>
        Relationships: []
      }
      telegram_user_mappings: {
        Row: TelegramUserMappingRow
        Insert: Omit<TelegramUserMappingRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<TelegramUserMappingRow>
        Relationships: []
      }
      raas_licenses: {
        Row: RaasLicenseRow
        Insert: RaasLicenseInsert
        Update: RaasLicenseUpdate
        Relationships: []
      }
      raas_audit_logs: {
        Row: RaasAuditLogRow
        Insert: RaasAuditLogInsert
        Update: Partial<RaasAuditLogRow>
        Relationships: [{
          foreignKeyName: 'raas_audit_logs_license_id_fkey'
          columns: ['license_id']
          referencedRelation: 'raas_licenses'
          referencedColumns: ['id']
        }]
      }
      usage_events: {
        Row: UsageEventRow
        Insert: UsageEventInsert
        Update: Partial<UsageEventRow>
        Relationships: []
      },
      usage_hourly_summaries: {
        Row: UsageHourlySummaryRow
        Insert: UsageHourlySummaryInsert
        Update: Partial<UsageHourlySummaryRow>
        Relationships: []
      },
      usage_daily_summaries: {
        Row: UsageDailySummaryRow
        Insert: UsageDailySummaryInsert
        Update: Partial<UsageDailySummaryRow>
        Relationships: []
      },
      usage_quota_usage: {
        Row: UsageQuotaUsageRow
        Insert: UsageQuotaUsageInsert
        Update: Partial<UsageQuotaUsageRow>
        Relationships: []
      }
      raas_api_keys: {
        Row: RaasApiKeyRow
        Insert: RaasApiKeyInsert
        Update: RaasApiKeyUpdate
        Relationships: []
      }
      overage_events: {
        Row: OverageEventRow
        Insert: OverageEventInsert
        Update: Partial<OverageEventRow>
        Relationships: []
      }
      quota_limits: {
        Row: QuotaLimitRow
        Insert: QuotaLimitInsert
        Update: Partial<QuotaLimitRow>
        Relationships: []
      }
      dunning_settings: {
        Row: DunningSettingsRow
        Insert: DunningSettingsInsert
        Update: Partial<DunningSettingsRow>
        Relationships: []
      }
      dunning_attempts: {
        Row: DunningAttemptRow
        Insert: DunningAttemptInsert
        Update: Partial<DunningAttemptRow>
        Relationships: []
      }
      billing_events: {
        Row: BillingEventRow
        Insert: BillingEventInsert
        Update: Partial<BillingEventRow>
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_rate_limit: {
        Args: {
          p_identifier: string
          p_window_seconds?: number
        }
        Returns: {
          current_count: number
        }[]
      }
      check_telegram_rate_limit: {
        Args: {
          p_chat_id: string
          p_command_type?: string
          p_max_requests?: number
          p_window_seconds?: number
        }
        Returns: {
          allowed: boolean
          current_count: number
          remaining: number
          oldest_timestamp: string
        }[]
      }
      cleanup_expired_rate_limits: {
        Args: {
          p_retention_hours?: number
        }
        Returns: {
          deleted_count: number
        }[]
      }
      get_telegram_user_session: {
        Args: {
          p_chat_id: string
        }
        Returns: {
          session_id: string
          state: string
          context_data: Json
          subscription_tier: string | null
          auth_cache: Json
          expires_at: string | null
        }[]
      }
      set_telegram_user_state: {
        Args: {
          p_chat_id: string
          p_state: string
          p_context_data?: Json
        }
        Returns: string
      }
      link_telegram_user: {
        Args: {
          p_chat_id: string
          p_user_id: string
        }
        Returns: string
      }
      get_user_by_telegram_chat_id: {
        Args: {
          p_chat_id: string
        }
        Returns: string
      }
      clear_telegram_session: {
        Args: {
          p_chat_id: string
        }
        Returns: boolean
      }
      update_session_subscription_tier: {
        Args: {
          p_chat_id: string
          p_tier: string
        }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ============================================================================
// RaaS API Keys Table (for /api/audit endpoint authentication)
// ============================================================================

export interface RaasApiKeyRow {
  id: string
  key_id: string
  key_hash: string
  owner_id: string
  permissions: Json
  created_at: string
  expires_at: number | null
  revoked_at: number | null
  last_used_at: number | null
  rate_limit_per_min: number
}

export interface RaasApiKeyInsert {
  key_id: string
  key_hash: string
  owner_id: string
  permissions: Json
  created_at?: string
  expires_at?: number | null
  revoked_at?: number | null
  last_used_at?: number | null
  rate_limit_per_min?: number
}

export interface RaasApiKeyUpdate {
  key_id?: string
  key_hash?: string
  owner_id?: string
  permissions?: Json
  expires_at?: number | null
  revoked_at?: number | null
  last_used_at?: number | null
  rate_limit_per_min?: number
  [key: string]: string | number | boolean | Json | null | undefined
}

// ============================================================================
// Quota Management Tables (Phase 6: Overage Billing)
// ============================================================================

export interface OverageEventRow {
  id: string
  user_id: string
  license_nonce: string
  exceeded_type: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests'
  exceeded_limit: number
  exceeded_current: number
  exceeded_by: number
  requested_credits: number
  endpoint: string | null
  service_name: string | null
  action: string | null
  tier_at_exceeded: string
  external_customer_id: string | null
  billable: boolean
  ip_address: string | null
  user_agent: string | null
  created_at: number
}

export interface OverageEventInsert {
  user_id: string
  license_nonce: string
  exceeded_type: 'hourly_credits' | 'daily_credits' | 'monthly_credits' | 'daily_requests'
  exceeded_limit: number
  exceeded_current: number
  exceeded_by: number
  requested_credits?: number
  endpoint?: string | null
  service_name?: string | null
  action?: string | null
  tier_at_exceeded: string
  external_customer_id?: string | null
  billable?: boolean
  ip_address?: string | null
  user_agent?: string | null
  created_at?: number
}

export interface QuotaLimitRow {
  id: string
  license_nonce: string
  custom_daily_credits: number | null
  custom_hourly_credits: number | null
  custom_monthly_credits: number | null
  custom_daily_requests: number | null
  overage_allowed: boolean
  overage_price_per_credit: number | null
  overage_hard_limit: number | null
  soft_warning_threshold: number
  hard_block_threshold: number
  created_at: number
  updated_at: number | null
  created_by: string | null
}

export interface QuotaLimitInsert {
  license_nonce: string
  custom_daily_credits?: number | null
  custom_hourly_credits?: number | null
  custom_monthly_credits?: number | null
  custom_daily_requests?: number | null
  overage_allowed?: boolean
  overage_price_per_credit?: number | null
  overage_hard_limit?: number | null
  soft_warning_threshold?: number
  hard_block_threshold?: number
  created_at?: number
  updated_at?: number | null
  created_by?: string | null
}

// ============================================================================
// Dunning Workflow Tables (Overage Billing & Dunning - 2026-03-09)
// ============================================================================

export type DunningState = 'current' | 'past_due' | 'delinquent' | 'suspended'

export interface DunningSettingsRow {
  id: string
  user_id: string
  license_nonce: string
  stripe_customer_id: string | null
  grace_period_days: number
  max_retry_attempts: number
  retry_schedule: string[]
  send_email_notifications: boolean
  email_language: string
  dunning_state: DunningState
  dunning_state_changed_at: string
  created_at: string
  updated_at: string
}

export interface DunningSettingsInsert {
  user_id: string
  license_nonce: string
  stripe_customer_id?: string | null
  grace_period_days?: number
  max_retry_attempts?: number
  retry_schedule?: string[]
  send_email_notifications?: boolean
  email_language?: string
  dunning_state?: DunningState
  created_at?: string
  updated_at?: string
}

export interface DunningAttemptRow {
  id: string
  user_id: string
  license_nonce: string
  attempt_number: number
  attempt_type: string
  payment_provider: string
  success: boolean
  amount: number | null
  currency: string
  failure_reason: string | null
  provider_response_id: string | null
  dunning_state_before: DunningState | null
  dunning_state_after: DunningState | null
  next_retry_at: string | null
  scheduled_retry_count: number
  stripe_invoice_id: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface DunningAttemptInsert {
  user_id: string
  license_nonce: string
  attempt_number?: number
  attempt_type: string
  payment_provider: string
  success?: boolean
  amount?: number | null
  currency?: string
  failure_reason?: string | null
  provider_response_id?: string | null
  dunning_state_before?: DunningState | null
  dunning_state_after?: DunningState | null
  next_retry_at?: string | null
  scheduled_retry_count?: number
  stripe_invoice_id?: string | null
  ip_address?: string | null
  user_agent?: string | null
  created_at?: string
}

export interface BillingEventRow {
  id: string
  user_id: string
  license_nonce: string
  event_type: string
  event_category: string
  event_data: Json
  amount: number | null
  currency: string
  payment_provider: string | null
  provider_event_id: string | null
  provider_invoice_id: string | null
  provider_charge_id: string | null
  email_sent: boolean
  email_template: string | null
  email_recipient: string | null
  email_sent_at: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  processed: boolean
  processed_at: string | null
}

export interface BillingEventInsert {
  user_id: string
  license_nonce: string
  event_type: string
  event_category: string
  event_data?: Json
  amount?: number | null
  currency?: string
  payment_provider?: string | null
  provider_event_id?: string | null
  provider_invoice_id?: string | null
  provider_charge_id?: string | null
  email_sent?: boolean
  email_template?: string | null
  email_recipient?: string | null
  email_sent_at?: string | null
  ip_address?: string | null
  user_agent?: string | null
  created_at?: string
  processed?: boolean
  processed_at?: string | null
}

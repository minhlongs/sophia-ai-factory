/**
 * Database interface type
 *
 * Type definition for D1 database binding with all tables.
 * This is a meta-type used by the typed D1 client.
 *
 * @module seed/types/database
 */

import type { Json } from './json';

export interface Database {
  public: {
    Tables: {
      affiliate_products: {
        Row: import('./affiliate').AffiliateProductRow
        Insert: Omit<import('./affiliate').AffiliateProductRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<import('./affiliate').AffiliateProductRow>
        Relationships: []
      }
      affiliate_metric_history: {
        Row: import('./affiliate').AffiliateMetricHistoryRow
        Insert: Omit<import('./affiliate').AffiliateMetricHistoryRow, 'id' | 'recorded_at'>
        Update: Partial<import('./affiliate').AffiliateMetricHistoryRow>
        Relationships: []
      }
      affiliate_categories: {
        Row: import('./affiliate').AffiliateCategoryRow
        Insert: Omit<import('./affiliate').AffiliateCategoryRow, 'id'>
        Update: Partial<import('./affiliate').AffiliateCategoryRow>
        Relationships: []
      }
      user_integrations: {
        Row: import('./affiliate').UserIntegrationRow
        Insert: Omit<import('./affiliate').UserIntegrationRow, 'id' | 'created_at' | 'updated_at' | 'is_active'> & { is_active?: boolean, created_at?: string, updated_at?: string }
        Update: Partial<import('./affiliate').UserIntegrationRow>
        Relationships: []
      }
      user_profiles: {
        Row: import('./user').UserProfileRow
        Insert: import('./user').UserProfileInsert
        Update: Partial<import('./user').UserProfileRow>
        Relationships: []
      }
      campaigns: {
        Row: import('./video').CampaignRow
        Insert: Omit<import('./video').CampaignRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'progress'> & {
          status?: 'draft' | 'queued' | 'processing_script' | 'processing_video' | 'completed' | 'failed'
          progress?: number
        }
        Update: Partial<import('./video').CampaignRow>
        Relationships: []
      }
      campaign_templates: {
        Row: import('./video').CampaignTemplateRow
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
        Update: Partial<import('./video').CampaignTemplateRow>
        Relationships: []
      }
      payment_events: {
        Row: {
          id: string
          event_type: string
          event_id: string
          payload: Json
          processed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          event_id: string
          payload: Json
          processed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          event_id?: string
          payload?: Json
          processed?: boolean
          created_at?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: import('./user').UserSessionRow
        Insert: Omit<import('./user').UserSessionRow, 'id' | 'created_at'>
        Update: Partial<import('./user').UserSessionRow>
        Relationships: []
      }
      rate_limits: {
        Row: import('./infra').RateLimitRow
        Insert: Omit<import('./infra').RateLimitRow, 'id' | 'created_at'>
        Update: Partial<import('./infra').RateLimitRow>
        Relationships: []
      }
      telegram_rate_limits: {
        Row: import('./infra').TelegramRateLimitRow
        Insert: Omit<import('./infra').TelegramRateLimitRow, 'id' | 'created_at'>
        Update: Partial<import('./infra').TelegramRateLimitRow>
        Relationships: []
      }
      telegram_user_mappings: {
        Row: import('./user').TelegramUserMappingRow
        Insert: Omit<import('./user').TelegramUserMappingRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<import('./user').TelegramUserMappingRow>
        Relationships: []
      }
      raas_licenses: {
        Row: import('./raas').RaasLicenseRow
        Insert: import('./raas').RaasLicenseInsert
        Update: import('./raas').RaasLicenseUpdate
        Relationships: []
      }
      raas_audit_logs: {
        Row: import('./raas').RaasAuditLogRow
        Insert: import('./raas').RaasAuditLogInsert
        Update: Partial<import('./raas').RaasAuditLogRow>
        Relationships: [{
          foreignKeyName: 'raas_audit_logs_license_id_fkey'
          columns: ['license_id']
          referencedRelation: 'raas_licenses'
          referencedColumns: ['id']
        }]
      }
      usage_events: {
        Row: import('./video').UsageEventRow
        Insert: import('./video').UsageEventInsert
        Update: Partial<import('./video').UsageEventRow>
        Relationships: []
      }
      usage_hourly_summaries: {
        Row: import('./infra').UsageHourlySummaryRow
        Insert: import('./infra').UsageHourlySummaryInsert
        Update: Partial<import('./infra').UsageHourlySummaryRow>
        Relationships: []
      }
      usage_daily_summaries: {
        Row: import('./infra').UsageDailySummaryRow
        Insert: import('./infra').UsageDailySummaryInsert
        Update: Partial<import('./infra').UsageDailySummaryRow>
        Relationships: []
      }
      usage_quota_usage: {
        Row: import('./infra').UsageQuotaUsageRow
        Insert: import('./infra').UsageQuotaUsageInsert
        Update: Partial<import('./infra').UsageQuotaUsageRow>
        Relationships: []
      }
      raas_api_keys: {
        Row: import('./raas').RaasApiKeyRow
        Insert: import('./raas').RaasApiKeyInsert
        Update: import('./raas').RaasApiKeyUpdate
        Relationships: []
      }
      overage_events: {
        Row: import('./billing').OverageEventRow
        Insert: import('./billing').OverageEventInsert
        Update: Partial<import('./billing').OverageEventRow>
        Relationships: []
      }
      quota_limits: {
        Row: import('./billing').QuotaLimitRow
        Insert: import('./billing').QuotaLimitInsert
        Update: import('./billing').QuotaLimitUpdate
        Relationships: []
      }
      dunning_settings: {
        Row: import('./billing').DunningSettingsRow
        Insert: import('./billing').DunningSettingsInsert
        Update: Partial<import('./billing').DunningSettingsRow>
        Relationships: []
      }
      dunning_attempts: {
        Row: import('./billing').DunningAttemptRow
        Insert: import('./billing').DunningAttemptInsert
        Update: Partial<import('./billing').DunningAttemptRow>
        Relationships: []
      }
      billing_events: {
        Row: import('./billing').BillingEventRow
        Insert: import('./billing').BillingEventInsert
        Update: Partial<import('./billing').BillingEventRow>
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

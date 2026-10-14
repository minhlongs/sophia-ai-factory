/**
 * Database Table Types & Schema Declarations
 *
 * Layer: seed/types/database
 */

import type { Json } from '../json';
import type {
  AffiliateCategoryRow,
  AffiliateMetricHistoryRow,
  AffiliateProductRow,
  UserIntegrationRow,
} from '../affiliate';
import type {
  UserProfileRow,
  UserProfileInsert,
  UserSessionRow,
  TelegramUserMappingRow,
} from '../user';
import type { CampaignRow, CampaignTemplateRow } from '../video';
import type { RateLimitRow, TelegramRateLimitRow } from '../infra';
import type {
  OverageEventRow,
  OverageEventInsert,
  QuotaLimitRow,
  QuotaLimitInsert,
  QuotaLimitUpdate,
  DunningSettingsRow,
  DunningSettingsInsert,
  DunningAttemptRow,
  DunningAttemptInsert,
  BillingEventRow,
  BillingEventInsert,
} from '../billing';

export interface DatabaseTables {
  affiliate_products: {
    Row: AffiliateProductRow;
    Insert: Omit<AffiliateProductRow, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<AffiliateProductRow>;
    Relationships: [];
  };
  affiliate_metric_history: {
    Row: AffiliateMetricHistoryRow;
    Insert: Omit<AffiliateMetricHistoryRow, 'id' | 'recorded_at'>;
    Update: Partial<AffiliateMetricHistoryRow>;
    Relationships: [];
  };
  affiliate_categories: {
    Row: AffiliateCategoryRow;
    Insert: Omit<AffiliateCategoryRow, 'id'>;
    Update: Partial<AffiliateCategoryRow>;
    Relationships: [];
  };
  user_integrations: {
    Row: UserIntegrationRow;
    Insert: Omit<UserIntegrationRow, 'id' | 'created_at' | 'updated_at' | 'is_active'> & {
      is_active?: boolean;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<UserIntegrationRow>;
    Relationships: [];
  };
  user_profiles: {
    Row: UserProfileRow;
    Insert: UserProfileInsert;
    Update: Partial<UserProfileRow>;
    Relationships: [];
  };
  campaigns: {
    Row: CampaignRow;
    Insert: Omit<CampaignRow, 'id' | 'created_at' | 'updated_at' | 'status' | 'progress'> & {
      status?: 'draft' | 'queued' | 'processing_script' | 'processing_video' | 'completed' | 'failed';
      progress?: number;
    };
    Update: Partial<CampaignRow>;
    Relationships: [];
  };
  campaign_templates: {
    Row: CampaignTemplateRow;
    Insert: {
      id: string;
      name: string;
      description: string;
      category: string;
      icon?: string;
      defaults: Json;
      is_predefined?: boolean;
      user_id?: string | null;
      created_at?: string;
      updated_at?: string;
    };
    Update: Partial<CampaignTemplateRow>;
    Relationships: [];
  };
  payment_events: {
    Row: {
      id: string;
      event_type: string;
      event_id: string;
      payload: Json;
      processed: boolean;
      created_at: string;
    };
    Insert: {
      id?: string;
      event_type: string;
      event_id: string;
      payload: Json;
      processed?: boolean;
      created_at?: string;
    };
    Update: {
      id?: string;
      event_type?: string;
      event_id?: string;
      payload?: Json;
      processed?: boolean;
      created_at?: string;
    };
    Relationships: [];
  };
  user_sessions: {
    Row: UserSessionRow;
    Insert: Omit<UserSessionRow, 'id' | 'created_at'>;
    Update: Partial<UserSessionRow>;
    Relationships: [];
  };
  rate_limits: {
    Row: RateLimitRow;
    Insert: Omit<RateLimitRow, 'id' | 'created_at'>;
    Update: Partial<RateLimitRow>;
    Relationships: [];
  };
  telegram_rate_limits: {
    Row: TelegramRateLimitRow;
    Insert: Omit<TelegramRateLimitRow, 'id' | 'created_at'>;
    Update: Partial<TelegramRateLimitRow>;
    Relationships: [];
  };
  telegram_user_mappings: {
    Row: TelegramUserMappingRow;
    Insert: Omit<TelegramUserMappingRow, 'id' | 'created_at' | 'updated_at'>;
    Update: Partial<TelegramUserMappingRow>;
    Relationships: [];
  };
  overage_events: {
    Row: OverageEventRow;
    Insert: OverageEventInsert;
    Update: Partial<OverageEventRow>;
    Relationships: [];
  };
  quota_limits: {
    Row: QuotaLimitRow;
    Insert: QuotaLimitInsert;
    Update: QuotaLimitUpdate;
    Relationships: [];
  };
  dunning_settings: {
    Row: DunningSettingsRow;
    Insert: DunningSettingsInsert;
    Update: Partial<DunningSettingsRow>;
    Relationships: [];
  };
  dunning_attempts: {
    Row: DunningAttemptRow;
    Insert: DunningAttemptInsert;
    Update: Partial<DunningAttemptRow>;
    Relationships: [];
  };
  billing_events: {
    Row: BillingEventRow;
    Insert: BillingEventInsert;
    Update: Partial<BillingEventRow>;
    Relationships: [];
  };
}

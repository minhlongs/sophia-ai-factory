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
  polar_subscription_id: string | null
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
  polar_subscription_id?: string | null
  subscription_expires_at?: string | null
  created_at?: string
  updated_at?: string
}

export interface UserSessionRow {
  telegram_chat_id: string
  state: string
  context_data: Json
  last_event: string
  updated_at: string
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
          polar_event_id: string
          payload: Json
          processed: boolean
          created_at: string
        }
        Insert: {
          id?: string
          event_type: string
          polar_event_id: string
          payload: Json
          processed?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          event_type?: string
          polar_event_id?: string
          payload?: Json
          processed?: boolean
          created_at?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: UserSessionRow
        Insert: UserSessionRow
        Update: Partial<UserSessionRow>
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      affiliate_products: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['affiliate_products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['affiliate_products']['Insert']>
      }
      affiliate_metric_history: {
        Row: {
          id: string
          product_id: string
          recorded_at: string
          metric_type: string
          value: number
        }
        Insert: Omit<Database['public']['Tables']['affiliate_metric_history']['Row'], 'id' | 'recorded_at'>
        Update: Partial<Database['public']['Tables']['affiliate_metric_history']['Insert']>
      }
      affiliate_categories: {
        Row: {
          id: number
          name: string
          slug: string
          parent_id: number | null
        }
        Insert: Omit<Database['public']['Tables']['affiliate_categories']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['affiliate_categories']['Insert']>
      }
      user_integrations: {
        Row: {
          id: string
          user_id: string
          network_id: 'clickbank' | 'shareasale' | 'amazon'
          api_key: string
          api_secret: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_integrations']['Row'], 'id' | 'created_at' | 'updated_at' | 'is_active'> & { is_active?: boolean, created_at?: string, updated_at?: string }
        Update: Partial<Database['public']['Tables']['user_integrations']['Insert']>
      }
      user_profiles: {
        Row: {
          user_id: string
          telegram_chat_id: string | null
          settings: Json | null
          api_keys: Json | null
          subscription_tier: 'free' | 'pro' | 'enterprise' | null
          subscription_status: string | null
          lemonsqueezy_customer_id: string | null
          lemonsqueezy_subscription_id: string | null
          lemonsqueezy_order_id: string | null
          polar_subscription_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          telegram_chat_id?: string | null
          settings?: Json | null
          api_keys?: Json | null
          subscription_tier?: 'free' | 'pro' | 'enterprise' | null
          subscription_status?: string | null
          lemonsqueezy_customer_id?: string | null
          lemonsqueezy_subscription_id?: string | null
          lemonsqueezy_order_id?: string | null
          polar_subscription_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
      }
      campaigns: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['campaigns']['Row'], 'id' | 'created_at' | 'updated_at' | 'status' | 'progress'> & {
            status?: 'draft' | 'queued' | 'processing_script' | 'processing_video' | 'completed' | 'failed'
            progress?: number
        }
        Update: Partial<Database['public']['Tables']['campaigns']['Row']>
      }
      campaign_templates: {
        Row: {
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
        Update: Partial<Database['public']['Tables']['campaign_templates']['Insert']>
      }
    }
  }
}

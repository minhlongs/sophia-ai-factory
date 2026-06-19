/**
 * Affiliate Domain Types
 *
 * Database row types for affiliate offers, user integrations, metrics.
 * Extracted from supabase-types.ts for modular organization.
 *
 * @module seed/types/affiliate
 */

import { Json } from './json';

// Affiliate product catalog (from affiliate_products table)
export interface AffiliateProductRow {
  id: string;
  external_id: string;
  network_id: 'clickbank' | 'shareasale' | 'amazon';
  title: string;
  description: string | null;
  affiliate_link: string;
  thumbnail_url: string | null;
  price_usd: number | null;
  commission_rate: number | null;
  avg_earnings_usd: number | null;
  raw_metrics: Json;
  sps_score: number | null;
  is_hidden_gem: boolean;
  category_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface AffiliateProductInsert {
  external_id: string;
  network_id: 'clickbank' | 'shareasale' | 'amazon';
  title: string;
  description?: string | null;
  affiliate_link: string;
  thumbnail_url?: string | null;
  price_usd?: number | null;
  commission_rate?: number | null;
  category_id?: number | null;
}

export interface AffiliateProductUpdate {
  external_id?: string;
  network_id?: 'clickbank' | 'shareasale' | 'amazon';
  title?: string;
  description?: string | null;
  affiliate_link?: string;
  thumbnail_url?: string | null;
  price_usd?: number | null;
  commission_rate?: number | null;
  category_id?: number | null;
  is_hidden_gem?: boolean;
  updated_at?: string;
}

// Affiliate metrics tracking
export interface AffiliateMetricHistoryRow {
  id: string;
  product_id: string;
  recorded_at: string;
  metric_type: string;
  value: number;
}

export interface AffiliateMetricHistoryInsert {
  product_id: string;
  metric_type: string;
  value: number;
}

// Affiliate category taxonomy
export interface AffiliateCategoryRow {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
}

export interface AffiliateCategoryInsert {
  name: string;
  slug: string;
  parent_id?: number | null;
}

export interface AffiliateCategoryUpdate {
  name?: string;
  slug?: string;
  parent_id?: number | null;
}

// User integration with affiliate networks
export interface UserIntegrationRow {
  id: string;
  user_id: string;
  network_id: 'clickbank' | 'shareasale' | 'amazon';
  api_key: string;
  api_secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserIntegrationInsert {
  user_id: string;
  network_id: 'clickbank' | 'shareasale' | 'amazon';
  api_key: string;
  api_secret?: string | null;
  is_active?: boolean;
}

export interface UserIntegrationUpdate {
  api_key?: string;
  api_secret?: string | null;
  is_active?: boolean;
  updated_at?: string;
}

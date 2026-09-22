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

// Sophia AI Factory Partner Program
export type PartnerTier = 'STANDARD' | 'VIP' | 'SUPER';
export type PartnerStatus = 'active' | 'suspended' | 'under_review';

export interface AffiliatePartnerRow {
  id: string;
  user_id: string;
  partner_code: string;
  tier: PartnerTier;
  commission_rate_pct: number;
  tier2_rate_pct: number;
  parent_partner_id: string | null;
  usdt_trc20_address_encrypted: string | null;
  status: PartnerStatus;
  total_earnings_cents: number;
  pending_payout_cents: number;
  created_at: number;
  updated_at: number;
}

export interface AffiliatePartner {
  id: string;
  userId: string;
  partnerCode: string;
  tier: PartnerTier;
  commissionRatePct: number;
  tier2RatePct: number;
  parentPartnerId?: string | null;
  usdtTrc20AddressEncrypted?: string | null;
  status: PartnerStatus;
  totalEarningsCents: number;
  pendingPayoutCents: number;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateReferralClickRow {
  id: string;
  affiliate_partner_id: string;
  partner_code: string;
  ip_hash: string | null;
  user_agent: string | null;
  referer_url: string | null;
  sub_id: string | null;
  created_at: number;
}

export interface AffiliateStats {
  partnerCode: string;
  tier: PartnerTier;
  commissionRatePct: number;
  tier2RatePct: number;
  totalClicks: number;
  totalConversions: number;
  conversionRatePct: number;
  totalEarningsCents: number;
  pendingPayoutCents: number;
  availablePayoutCents: number;
  lifetimePaidCents: number;
}

export interface PayoutBatchWithdrawal {
  partnerId: string;
  address: string; // TRC-20 address
  amount: number; // in USDT
}

export interface PayoutBatchRequest {
  batchId: string;
  currency: 'usdttrc20';
  withdrawals: PayoutBatchWithdrawal[];
}

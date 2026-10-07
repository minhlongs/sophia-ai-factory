/**
 * Affiliate Domain Types
 *
 * Database row types, domain models, and transfer interfaces for the
 * Sophia AI Factory Interactive Affiliate & Partner Ecosystem.
 * Pure seed types — zero upward imports from tree, forest, or land.
 *
 * @module seed/types/affiliate
 */

import { Json } from './json';

// ============================================================================
// Legacy Catalog & User Integration Types
// ============================================================================

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

// ============================================================================
// Sophia Partner Program & Tier Modeling
// ============================================================================

export type PartnerTier = 'STANDARD' | 'VIP' | 'SUPER' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type PartnerStatus = 'active' | 'suspended' | 'under_review';
export type PayoutRail = 'USDT' | 'VIETQR';

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
  settled_payout_cents?: number;
  custom_rate_override_pct?: number | null;
  payout_rail?: PayoutRail | null;
  bank_bin?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  activated_mrr_cents?: number;
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
  settledPayoutCents?: number;
  customRateOverridePct?: number | null;
  payoutRail?: PayoutRail | null;
  bankBin?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  activatedMrrCents?: number;
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

// ============================================================================
// Milestone 1: Attribution, Commission & Ledger Settlement Types
// ============================================================================

export type ReferralStatus = 'pending' | 'converted' | 'expired';

export interface AffiliateReferralRow {
  id: string;
  partner_id: string;
  partner_code: string;
  referred_user_id: string | null;
  sub_id: string | null;
  attribution_token: string | null;
  click_id: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  status: ReferralStatus;
  converted_at: number | null;
  created_at: number;
  updated_at: number;
}

export type CommissionStatus = 'pending' | 'payable' | 'settled' | 'clawback' | 'rejected';
export type CommissionTierLevel = 'TIER1' | 'TIER2';
export type PaymentProvider = 'nowpayments' | 'payos' | 'manual';

export interface AffiliateCommissionRow {
  id: string;
  event_key: string;
  partner_id: string;
  referral_id: string | null;
  payment_provider: PaymentProvider;
  payment_id: string;
  order_id: string | null;
  customer_user_id: string;
  gross_amount_cents: number;
  commission_rate_pct: number;
  commission_cents: number;
  tier_level: CommissionTierLevel;
  currency: string;
  status: CommissionStatus;
  hold_days: number;
  payable_at: number;
  settled_at: number | null;
  payout_id: string | null;
  version: number;
  metadata_json: string | null;
  created_at: number;
  updated_at: number;
}

export type PayoutStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'rejected';

export interface AffiliatePayoutRow {
  id: string;
  payout_reference: string;
  partner_id: string;
  rail: PayoutRail;
  amount_cents: number;
  currency: string;
  destination_encrypted: string;
  status: PayoutStatus;
  commission_count: number;
  tx_hash_or_bank_ref: string | null;
  approved_by: string | null;
  approved_at: number | null;
  failure_reason: string | null;
  version: number;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// AI Offer Discovery & Catalog Types
// ============================================================================

export type AffiliateOfferCategory = 'SaaS' | 'E-Commerce' | 'Creator Tools' | 'Agency Automation';
export type AffiliatePayoutModel = 'RevShare %' | 'Flat CPA' | 'Recurring' | 'RevShare';

export interface AffiliateOfferRow {
  id: string;
  program_name: string;
  title?: string | null;
  category: AffiliateOfferCategory | string;
  payout_model: AffiliatePayoutModel | string;
  commission_rate_pct: number;
  commission_terms: string;
  epc: number;
  conversion_rate_pct: number;
  quality_score: number;
  destination_url: string;
  product_url?: string | null;
  logo_url: string | null;
  image_url?: string | null;
  cookie_window_days: number;
  min_payout_usd: number;
  status: string;
  tenant_id?: string | null;
  network_id?: string | null;
  external_id?: string | null;
  created_at: number;
  updated_at: number;
}

export interface AffiliateOffer {
  id: string;
  programName: string;
  category: AffiliateOfferCategory;
  payoutModel: AffiliatePayoutModel;
  commissionRatePct: number;
  commissionTerms: string;
  epc: number;
  conversionRatePct: number;
  qualityScore: number;
  destinationUrl: string;
  logoUrl?: string;
  cookieWindowDays: number;
  minPayoutUsd: number;
  status?: string;
}

// ============================================================================
// Partner Invitation & Onboarding Types
// ============================================================================

export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface AffiliateInviteRow {
  id: string;
  inviter_user_id: string;
  partner_name: string;
  email: string;
  custom_commission_rate_pct: number | null;
  welcome_message: string | null;
  asset_kit_urls: string | null;
  invite_token: string;
  status: InviteStatus;
  expires_at: number;
  accepted_at: number | null;
  accepted_partner_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface InviteAffiliateInput {
  partnerName: string;
  email: string;
  customRateOverridePct: number;
  welcomeMessage?: string;
  assetKitSelected?: string[];
}

export interface InviteAffiliateResult {
  success: boolean;
  inviteId?: string;
  emailDispatched?: boolean;
  error?: string;
}

// ============================================================================
// Ledger Aggregations & Attribution Result Types
// ============================================================================

export interface AffiliateLedgerStats {
  totalAffiliates: number;
  activeAffiliates: number;
  totalCommissionCents: number;
  pendingCommissionCents: number;
  settledCommissionCents: number;
  currency: string;
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
  address: string; // TRC-20 address or bank descriptor
  amount: number; // in USDT or VND
}

export interface PayoutBatchRequest {
  batchId: string;
  currency: 'usdttrc20' | 'vnd';
  withdrawals: PayoutBatchWithdrawal[];
}

export interface AttributionParams {
  provider: PaymentProvider;
  paymentId: string;
  orderId?: string | null;
  customerId: string;
  grossAmountCents: number;
  currency?: string;
  partnerCodeOverride?: string;
}

export interface AffiliateAttributionResult {
  success: boolean;
  attributed: boolean;
  commissionId?: string;
  tier2CommissionId?: string;
  commissionCents?: number;
  partnerId?: string;
  reason?: string;
  error?: string;
}

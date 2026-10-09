/**
 * Partner Database Entities
 *
 * Layer: tree (pure domain types & contracts)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/types/partner-entities
 */

import type {
  PartnerTier,
  PartnerType,
  PartnerStatus,
  PayoutRail,
  CommissionStatus,
} from './core-types';

/**
 * Database Entity: Partner Profile
 */
export interface PartnerProfile {
  id: string;
  user_id: string;
  tenant_id: string;
  partner_name: string;
  partner_type: PartnerType;
  tier: PartnerTier;
  commission_rate_pct: number;
  referral_code: string;
  custom_domain: string | null;
  whitelabel_enabled: number; // 0 or 1 SQLite boolean
  total_referred_customers: number;
  total_mrr_cents: number;
  total_earnings_cents: number;
  pending_payout_cents: number;
  payout_rail: PayoutRail;
  payout_destination_json: string;
  status: PartnerStatus;
  created_at: number;
  updated_at: number;
}

/**
 * Database Entity: Partner Commission Accrual Entry
 */
export interface PartnerCommission {
  id: string;
  partner_id: string;
  referred_user_id: string;
  referred_tenant_id: string;
  order_id: string;
  mrr_cents: number;
  commission_rate_pct: number;
  commission_cents: number;
  tier_at_time: PartnerTier;
  status: CommissionStatus;
  payout_batch_id: string | null;
  period_start: number | null;
  period_end: number | null;
  created_at: number;
}

/**
 * Database Entity: Partner White-Label Configuration
 */
export interface PartnerWhitelabelConfig {
  id: string;
  partner_id: string;
  brand_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  accent_color: string;
  custom_domain: string | null;
  custom_email_sender: string | null;
  support_url: string | null;
  footer_html: string | null;
  is_ssl_active: number; // 0 or 1 SQLite boolean
  dns_txt_verification_token: string | null;
  dns_verified_at: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * White-Label Resolved CSS Theme & Branding Assets
 */
export interface WhitelabelCssTheme {
  brandPrimary: string;
  brandAccent: string;
  brandLogoUrl: string;
  brandFaviconUrl: string;
  brandAgencyName: string;
  brandSupportUrl: string;
  customCssProperties: Record<string, string>;
}

/**
 * Types & Domain Contracts for Global Partner & White-Label Agency Engine
 *
 * Layer: tree (pure domain types & contracts)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/types
 */

export type PartnerTier = 'SILVER' | 'GOLD' | 'PLATINUM';

export type PartnerType = 'agency' | 'reseller' | 'affiliate' | 'integrator';

export type PartnerStatus = 'active' | 'suspended' | 'pending_approval';

export type PayoutRail = 'USDT' | 'VIETQR' | 'BANK_WIRE';

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'clawed_back';

/**
 * Partner Tier Configuration & Thresholds
 */
export interface TierThresholdConfig {
  tier: PartnerTier;
  ratePct: number;
  minCustomers: number;
  minMrrCents: number;
  whitelabelEnabled: boolean;
}

export const PARTNER_TIERS: Record<PartnerTier, TierThresholdConfig> = {
  SILVER: {
    tier: 'SILVER',
    ratePct: 20.0,
    minCustomers: 0,
    minMrrCents: 0,
    whitelabelEnabled: false,
  },
  GOLD: {
    tier: 'GOLD',
    ratePct: 28.0,
    minCustomers: 10,
    minMrrCents: 500_000, // $5,000
    whitelabelEnabled: false,
  },
  PLATINUM: {
    tier: 'PLATINUM',
    ratePct: 35.0,
    minCustomers: 30,
    minMrrCents: 2_000_000, // $20,000
    whitelabelEnabled: true,
  },
} as const;

/** 90-day referral attribution window in days */
export const ATTRIBUTION_WINDOW_DAYS = 90;
export const ATTRIBUTION_WINDOW_MS = ATTRIBUTION_WINDOW_DAYS * 86_400 * 1000;

/** Minimum payout threshold in cents ($50.00) */
export const MIN_PAYOUT_THRESHOLD_CENTS = 5_000;

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

/**
 * Input for Registering as a Partner
 */
export interface RegisterPartnerInput {
  userId: string;
  tenantId: string;
  partnerName: string;
  partnerType?: PartnerType;
  referralCode?: string;
  payoutRail?: PayoutRail;
  payoutDestinationJson?: string;
}

/**
 * Input for Accruing Commission
 */
export interface AccrueCommissionInput {
  partnerId: string;
  referredUserId: string;
  referredTenantId: string;
  orderId: string;
  mrrCents: number;
  isNewCustomer?: boolean;
  referredAtMs?: number; // Timestamp of initial referral attribution for 90-day window check
  periodStart?: number;
  periodEnd?: number;
}

/**
 * Result of Commission Accrual
 */
export interface CommissionResult {
  success: boolean;
  commissionId?: string;
  partnerId: string;
  orderId: string;
  commissionCents: number;
  commissionRatePct: number;
  tierAtTime: PartnerTier;
  duplicate?: boolean;
  tierPromoted?: boolean;
  newTier?: PartnerTier;
  error?: string;
}

/**
 * Result of Partner Tier Evaluation
 */
export interface EvaluateTierResult {
  partnerId: string;
  currentTier: PartnerTier;
  newTier: PartnerTier;
  promoted: boolean;
  commissionRatePct: number;
  whitelabelEnabled: boolean;
}

/**
 * Input for Configuring White-Label Assets
 */
export interface WhitelabelConfigInput {
  partnerId: string;
  brandName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor?: string;
  accentColor?: string;
  customDomain?: string | null;
  customEmailSender?: string | null;
  supportUrl?: string | null;
  footerHtml?: string | null;
}

/**
 * Input for Requesting Commission Payout
 */
export interface PayoutRequestInput {
  partnerId: string;
  amountCents: number;
  payoutRail: PayoutRail;
  destinationDetails: Record<string, unknown>;
}

/**
 * Result of Payout Request
 */
export interface PayoutRequestResult {
  success: boolean;
  partnerId: string;
  payoutBatchId: string;
  amountCents: number;
  remainingPendingCents: number;
  payoutRail: PayoutRail;
  error?: string;
}

/**
 * Aggregated Partner Dashboard Data
 */
export interface PartnerDashboardData {
  profile: PartnerProfile;
  whitelabelConfig: PartnerWhitelabelConfig | null;
  recentCommissions: PartnerCommission[];
  nextTier: {
    targetTier: PartnerTier | null;
    customersRemaining: number;
    mrrRemainingCents: number;
    progressPct: number;
  };
}

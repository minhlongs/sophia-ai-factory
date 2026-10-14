import type { PartnerTier } from './partner';

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

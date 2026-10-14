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

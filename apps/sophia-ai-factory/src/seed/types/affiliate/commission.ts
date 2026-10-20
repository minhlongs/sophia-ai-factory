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

export interface AttributionParams {
  provider: PaymentProvider;
  paymentId: string;
  orderId?: string | null;
  customerId: string;
  grossAmountCents: number;
  currency?: string;
  partnerCodeOverride?: string;
  /**
   * Tracking code read from the `ref` query parameter of an affiliate link.
   * Cookie-free fallback used when the visitor declines marketing consent.
   */
  refParam?: string | null;
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

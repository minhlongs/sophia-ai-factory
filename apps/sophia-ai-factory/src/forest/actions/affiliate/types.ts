/**
 * Affiliate Actions Submodule: Types & Interfaces.
 * Layer: forest (Server Actions / Orchestrators)
 *
 * @module forest/actions/affiliate/types
 */

import type { AffiliateOffer } from '@/seed/types/affiliate';

export type { AffiliateOffer };
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
  inviteLink?: string;
  error?: string;
}

export interface ValidateAffiliateInviteResult {
  valid: boolean;
  invite?: {
    id: string;
    partnerName: string;
    email: string;
    customCommissionRatePct: number;
    welcomeMessage?: string;
    assetKits?: string[];
    expiresAt: number;
    status: string;
  };
  reason?: 'NOT_FOUND' | 'ALREADY_REDEEMED' | 'EXPIRED' | 'DB_UNAVAILABLE';
}

export interface AcceptAffiliateInviteInput {
  token: string;
  preferredPartnerCode?: string;
  userId?: string;
}

export interface AcceptAffiliateInviteResult {
  success: boolean;
  partnerCode?: string;
  referralLink?: string;
  partnerId?: string;
  error?: string;
}

export interface GetAffiliateOffersInput {
  category?: string;
  payoutModel?: string;
  search?: string;
  sortBy?: 'epc' | 'conversion' | 'commission' | 'quality';
  limit?: number;
  offset?: number;
}

export interface GetAffiliateOffersResult {
  success: boolean;
  offers: AffiliateOffer[];
  total: number;
  error?: string;
}

export interface AdoptAffiliateOfferInput {
  offerId: string;
  target: 'creator_studio' | 'distribution_queue';
  campaignName?: string;
}

export interface AdoptAffiliateOfferResult {
  success: boolean;
  campaignId?: string;
  target?: 'creator_studio' | 'distribution_queue';
  deepLink?: string;
  message?: string;
  error?: string;
}

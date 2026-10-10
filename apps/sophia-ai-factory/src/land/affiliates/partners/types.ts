import type {
  AffiliatePartner,
  AffiliatePartnerRow,
  PartnerTier,
  PartnerStatus,
  AffiliateStats,
} from '@/seed/types/affiliate';

export interface RegisterPartnerInput {
  userId: string;
  requestedCode?: string;
  parentPartnerId?: string;
  usdtTrc20Address?: string;
  tier?: PartnerTier;
}

export interface CalculateCommissionInput {
  orderAmountCents: number;
  activeSalesCount: number;
  isTier2?: boolean;
  partnerTier?: PartnerTier;
  customRatePct?: number;
}

export interface CommissionCalculationResult {
  ratePct: number;
  commissionCents: number;
  tier: PartnerTier | 'TIER2';
  isTier2: boolean;
}

export interface ShareLinkOptions {
  subId?: string;
  baseUrl?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
}

export interface RecordClickInput {
  partnerCode: string;
  ipHash?: string;
  userAgent?: string;
  refererUrl?: string;
  subId?: string;
}

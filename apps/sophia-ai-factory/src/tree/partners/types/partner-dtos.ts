/**
 * Partner Operation DTOs and Inputs
 *
 * Layer: tree (pure domain types & contracts)
 * Adheres strictly to the Sophia 4-layer architecture.
 *
 * @module tree/partners/types/partner-dtos
 */

import type {
  PartnerTier,
  PartnerType,
  PayoutRail,
} from './core-types';
import type {
  PartnerProfile,
  PartnerCommission,
  PartnerWhitelabelConfig,
} from './partner-entities';

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

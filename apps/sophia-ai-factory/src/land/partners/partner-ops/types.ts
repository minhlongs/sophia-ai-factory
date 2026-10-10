/**
 * Partner Server Actions Types & Data Contracts
 *
 * Layer: land/partners/partner-ops
 *
 * @module land/partners/partner-ops/types
 */

import type {
  PartnerProfile,
  PartnerDashboardData,
  PayoutRail,
  PayoutRequestResult,
  PartnerWhitelabelConfig,
  WhitelabelCssTheme,
  CommissionResult,
  PartnerType,
} from '@/tree/partners/types';

export type {
  PartnerProfile,
  PartnerDashboardData,
  PayoutRail,
  PayoutRequestResult,
  PartnerWhitelabelConfig,
  WhitelabelCssTheme,
  CommissionResult,
  PartnerType,
};

export interface PartnerActionError {
  code: string;
  message: string;
}

export interface RegisterPartnerActionInput {
  partnerName: string;
  partnerType?: PartnerType;
  referralCode?: string;
  payoutRail?: PayoutRail;
  payoutDestinationJson?: string;
}

export interface RequestPayoutActionInput {
  amountCents: number;
  payoutRail: PayoutRail;
  destinationDetails: Record<string, unknown>;
}

export interface ConfigureWhitelabelActionInput {
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

export interface AccrueCommissionActionInput {
  partnerId: string;
  orderId: string;
  referredUserId: string;
  referredTenantId: string;
  mrrCents: number;
  isNewCustomer?: boolean;
  referredAtMs?: number;
}

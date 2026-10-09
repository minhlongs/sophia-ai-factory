/**
 * Co-Op Marketing Funds Engine Types & DTOs
 *
 * Layer: tree
 *
 * @module tree/partners/co-op/types
 */

import type {
  PartnerTier,
  CoOpBudgetAllocation,
  PartnerCoOpClaim,
  AuditCoOpClaimResult,
} from '@/tree/partners/types';

export interface InvoiceAppraisalInput {
  claimId?: string;
  vendorName?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  invoiceDate: number;
  periodStart?: number;
  periodEnd?: number;
  requestedAmountCents: number;
  availableBudgetCents: number;
  campaignName?: string;
  proofUrl?: string;
  brandKeywords?: string[];
  notes?: string;
  isWhitelistedVendor?: boolean;
}

export interface AccrueCoOpBudgetResult {
  success: boolean;
  allocation?: CoOpBudgetAllocation;
  allocatedCents: number;
  alreadyAccrued?: boolean;
  error?: string;
}

export interface SubmitCoOpClaimResult {
  success: boolean;
  claim?: PartnerCoOpClaim;
  auditResult?: AuditCoOpClaimResult;
  error?: string;
}

export interface SweepExpiredBudgetsResult {
  expiredCount: number;
  reclaimedCents: number;
}

export interface PartnerCoOpSummary {
  partnerId: string;
  partnerName: string;
  tier: PartnerTier;
  isEligible: boolean;
  accrualRatePct: number;
  totalAllocatedCents: number;
  totalClaimedCents: number;
  remainingActiveBudgetCents: number;
  availableBudgetCents?: number;
  activeAllocationsCount: number;
  pendingClaimsCount: number;
  approvedClaimsCount: number;
}

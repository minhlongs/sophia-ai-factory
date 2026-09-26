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

// ============================================================================
// Enterprise Reseller Federation & Co-Op Engine Contracts
// ============================================================================

export type PartnerOrganizationType =
  | 'master_agency'
  | 'sub_agency'
  | 'standard_partner'
  | 'enterprise_reseller';

export type SubResellerStatus = 'active' | 'suspended' | 'terminated' | 'paused';

export type LicensePoolStatus = 'active' | 'exhausted' | 'expired' | 'revoked';

export type CoOpClaimType =
  | 'paid_ads'
  | 'influencer_sponsorship'
  | 'offline_event'
  | 'creative_production'
  | 'co_branded_content'
  | 'digital_ads'
  | 'event_sponsorship'
  | 'content_creation'
  | 'webinar'
  | 'print_media'
  | 'other';

export type CoOpClaimStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'paid'
  | 'disbursed'
  | 'cancelled';

export type BudgetAllocationStatus = 'active' | 'exhausted' | 'expired' | 'locked' | 'closed';

export type PayoutBatchType = 'commission' | 'co_op_reimbursement' | 'hybrid';

export type PayoutBatchStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * Database Entity: Partner Organization
 */
export interface PartnerOrganization {
  id: string;
  partner_id: string;
  tenant_id: string;
  name: string;
  slug: string | null;
  organization_type: PartnerOrganizationType;
  tier: PartnerTier;
  cascade_override_pct: number;
  billing_email: string;
  custom_domain: string | null;
  whitelabel_config_json: string;
  status: 'active' | 'suspended' | 'pending' | 'pending_approval';
  created_at: number;
  updated_at: number;
}

/**
 * Database Entity: Partner Sub-Reseller Hierarchy Link
 */
export interface PartnerSubReseller {
  id: string;
  master_partner_id: string;
  sub_partner_id: string;
  agreement_ref: string | null;
  override_rate_pct: number;
  lifetime_override_cents: number;
  pending_override_cents: number;
  status: SubResellerStatus;
  joined_at: number;
  updated_at: number;
}

/**
 * Database Entity: Partner License Pool
 */
export interface PartnerLicensePool {
  id: string;
  partner_id: string;
  pool_name: string;
  total_seats: number;
  allocated_seats: number;
  total_mcu_credits: number;
  allocated_mcu_credits: number;
  consumed_mcu_credits: number;
  unit_price_cents: number;
  auto_topup_enabled: number; // 0 or 1
  auto_topup_threshold_mcu: number;
  auto_topup_amount_mcu: number;
  period_start: number | null;
  period_end: number | null;
  auto_renew: number; // 0 or 1
  status: LicensePoolStatus;
  created_at: number;
  updated_at: number;
}

/**
 * Database Entity: Co-Op Budget Allocation
 */
export interface CoOpBudgetAllocation {
  id: string;
  partner_id: string;
  billing_cycle_month: string; // 'YYYY-MM'
  tier_at_time: 'GOLD' | 'PLATINUM';
  mrr_basis_cents: number;
  accrual_rate_pct: number;
  allocated_cents: number;
  claimed_cents: number;
  remaining_cents: number;
  expires_at: number;
  status: BudgetAllocationStatus;
  created_at: number;
  updated_at: number;
}

/**
 * Database Entity: Partner Payout Batch
 */
export interface PartnerPayoutBatch {
  id: string;
  partner_id: string | null;
  batch_type: PayoutBatchType;
  payout_rail: PayoutRail;
  total_amount_cents: number;
  currency: 'USD' | 'VND' | 'USDT';
  total_amount_local: number;
  fx_rate: number;
  item_count: number;
  destination_address: string | null;
  tx_hash: string | null;
  status: PayoutBatchStatus;
  external_reference: string | null;
  raw_response_json: string;
  error_message: string | null;
  executed_at: number | null;
  completed_at: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * Database Entity: Partner Co-Op Claim
 */
export interface PartnerCoOpClaim {
  id: string;
  partner_id: string;
  budget_allocation_id: string | null;
  campaign_name: string;
  claim_type: CoOpClaimType;
  invoice_number: string;
  invoice_url: string;
  invoice_date: number;
  requested_amount_cents: number;
  approved_amount_cents: number;
  reimbursement_currency: 'USDT' | 'VND';
  status: CoOpClaimStatus;
  audit_score: number;
  audit_notes_json: string;
  rejection_reason: string | null;
  payout_batch_id: string | null;
  reviewed_by: string | null;
  reviewed_at: number | null;
  paid_at: number | null;
  created_at: number;
  updated_at: number;
}

// ============================================================================
// Service DTOs: Reseller Hierarchy & Cascade Overrides
// ============================================================================

export interface CascadeOverrideResult {
  hasMaster: boolean;
  masterPartnerId: string | null;
  overrideCents: number;
  overrideRatePct: number;
  subPartnerCommissionCents: number;
  subPartnerRatePct: number;
  platformNetCents: number;
}

export interface BindSubResellerInput {
  masterPartnerId: string;
  subPartnerId: string;
  agreementRef?: string | null;
}

export interface BindSubResellerResult {
  success: boolean;
  binding?: PartnerSubReseller;
  error?: string;
}

export interface ResellerHierarchyNode {
  id: string;
  subPartnerId: string;
  partnerName: string;
  tier: PartnerTier;
  status: SubResellerStatus;
  totalMrrCents: number;
  overrideRatePct: number;
  lifetimeOverrideCents: number;
  pendingOverrideCents: number;
  joinedAt: number;
}

export interface ResellerHierarchyTreeResult {
  masterPartnerId: string;
  masterPartnerName: string;
  masterTier: PartnerTier;
  masterStatus: PartnerStatus;
  totalSubAgencies: number;
  activeSubAgencies: number;
  totalSubMrrCents: number;
  totalLifetimeOverrideCents: number;
  totalPendingOverrideCents: number;
  subAgencies: ResellerHierarchyNode[];
}

export interface AccrueCascadeOverrideResult {
  success: boolean;
  overrideCents: number;
  masterPartnerId: string | null;
  escrowed: boolean;
  reason?: string;
  error?: string;
}

// ============================================================================
// Service DTOs: Bulk License & MCU Quota Pooling
// ============================================================================

export interface CreateLicensePoolInput {
  partnerId: string;
  poolName: string;
  seats: number;
  mcuCredits: number;
  unitPriceCents: number;
  autoTopupEnabled?: boolean;
  autoTopupThresholdMcu?: number;
  autoTopupAmountMcu?: number;
  periodStart?: number;
  periodEnd?: number;
  autoRenew?: boolean;
}

export interface CreateLicensePoolResult {
  success: boolean;
  pool?: PartnerLicensePool;
  error?: string;
}

export interface AllocateLicensePoolInput {
  poolId: string;
  subaccountId: string;
  seats: number;
  mcuCredits: number;
}

export type AllocatePoolInput = AllocateLicensePoolInput;

export interface AllocateLicensePoolResult {
  success: boolean;
  poolId: string;
  subaccountId: string;
  allocatedSeats: number;
  allocatedMcuCredits: number;
  remainingPoolSeats: number;
  remainingPoolMcu: number;
  error?: string;
}

export type AllocatePoolResult = AllocateLicensePoolResult;

export interface RecordMcuConsumptionInput {
  poolId: string;
  subaccountId: string;
  mcuConsumed: number;
}

export interface RecordMcuConsumptionResult {
  success: boolean;
  poolId: string;
  subaccountId: string;
  mcuConsumed: number;
  totalConsumedMcu: number;
  remainingAllocatedMcu: number;
  thresholdTriggered: boolean;
  autoTopupExecuted: boolean;
  error?: string;
}

// ============================================================================
// Service DTOs: Co-Op Marketing & Payout Settlement
// ============================================================================

export interface SubmitCoOpClaimInput {
  partnerId: string;
  campaignName: string;
  claimType: CoOpClaimType;
  invoiceNumber: string;
  invoiceUrl: string;
  invoiceDate: number;
  requestedAmountCents: number;
  reimbursementCurrency: 'USDT' | 'VND';
}

export interface AuditCoOpClaimResult {
  claimId: string;
  auditScore: number;
  isAutoApproved: boolean;
  approvedAmountCents: number;
  breakdown: {
    vendorVerified: boolean;
    dateValid: boolean;
    proofProvided: boolean;
    budgetSufficient: boolean;
  };
  notes: string[];
}

export interface PayoutBatchExecutionResult {
  batchId: string;
  success: boolean;
  payoutRail: PayoutRail;
  totalAmountCents: number;
  totalAmountLocal: number;
  itemCount: number;
  externalReference?: string;
  status?: PayoutBatchStatus;
  txHash?: string;
  error?: string;
}


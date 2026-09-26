/**
 * Co-Op Marketing Funds & Automated Revenue-Share Settlement Engine
 *
 * Layer: tree (domain business logic, heuristic appraisal & D1 database operations)
 * Adheres strictly to the Sophia 4-layer architecture (seed -> tree -> forest -> land).
 *
 * Invariants:
 * 1. Eligibility & Accrual: 5% monthly gross MRR accrual for Gold (28%) & Platinum (35%) partners.
 *    Silver (20%) accrues 0%. Formula: Math.floor((mrrCents * 5) / 100).
 * 2. 90-Day Budget Expiry: Allocations expire after 90 days (expires_at = created_at + 90 * 86,400 * 1,000).
 * 3. Solvency & Balance: Claims cannot exceed uncommitted balance in co_op_budget_allocations.
 * 4. Heuristic Appraisal Scoring (0-100):
 *    - Vendor Whitelist (25 pts): Verified ad network or agency.
 *    - Date Alignment (25 pts): Invoice date within billing cycle + 15-day grace.
 *    - Campaign Proof & Brand Keywords (25 pts): Verified proof with brand keywords.
 *    - Budget Solvency (25 pts): Requested amount <= available uncommitted budget.
 *    - Score >= 85 and Amount <= $2,000 (200,000 cents) -> Auto-approved. Else routes to under_review.
 * 5. Idempotency: Duplicate invoice submission rejected per partner.
 *
 * @module tree/partners/co-op-engine
 */

import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerProfile,
  PartnerTier,
  CoOpBudgetAllocation,
  PartnerCoOpClaim,
  CoOpClaimType,
  CoOpClaimStatus,
  SubmitCoOpClaimInput,
  AuditCoOpClaimResult,
} from '@/tree/partners/types';

// ============================================================================
// Constants
// ============================================================================

/** Standard 5.0% monthly Co-Op marketing accrual rate for Gold & Platinum tiers */
export const CO_OP_ACCRUAL_RATE_PCT = 5.0;

/** Budget allocation expiration period: 90 days */
export const CO_OP_BUDGET_EXPIRY_DAYS = 90;
export const CO_OP_BUDGET_EXPIRY_MS = CO_OP_BUDGET_EXPIRY_DAYS * 86_400 * 1000;

/** Grace period for invoice date relative to billing cycle: 15 days */
export const CO_OP_GRACE_PERIOD_DAYS = 15;
export const CO_OP_GRACE_PERIOD_MS = CO_OP_GRACE_PERIOD_DAYS * 86_400 * 1000;

/** Minimum appraisal score for automated approval */
export const AUTO_APPROVAL_SCORE_THRESHOLD = 85;

/** Maximum claim amount in cents for automated approval ($2,000.00) */
export const AUTO_APPROVAL_MAX_AMOUNT_CENTS = 200_000;

/** Recognized major ad networks & verified platforms */
export const VERIFIED_AD_NETWORKS = [
  'google',
  'meta',
  'facebook',
  'instagram',
  'tiktok',
  'linkedin',
  'twitter',
  'x ads',
  'x.com',
  'youtube',
  'apple search',
  'bing',
  'microsoft',
] as const;

/** Brand keywords required in campaign metadata or proof */
export const SOPHIA_BRAND_KEYWORDS = [
  'sophia',
  'agencyos',
  'ai factory',
  'sophia-ai',
  'sophia ai',
] as const;

// ============================================================================
// Domain Contracts & DTOs
// ============================================================================

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

// ============================================================================
// Core Domain Logic
// ============================================================================

/**
 * Calculates monthly Co-Op marketing fund accrual with guaranteed zero penny leakage.
 *
 * Rules:
 * - GOLD (28%) & PLATINUM (35%) partners are eligible for 5% monthly Co-Op accrual.
 * - SILVER (20%) partners accrue 0%.
 * - Formula: Math.floor((mrrCents * 5) / 100).
 *
 * @param mrrCents - Monthly gross MRR in cents.
 * @param tier - Partner tier ('SILVER' | 'GOLD' | 'PLATINUM').
 * @returns Accrued Co-Op budget in cents.
 */
export function calculateMonthlyCoOpAccrual(mrrCents: number, tier: PartnerTier): number {
  if (mrrCents <= 0 || !Number.isFinite(mrrCents)) {
    return 0;
  }

  // Only Gold and Platinum tiers receive Co-Op funds
  if (tier !== 'GOLD' && tier !== 'PLATINUM') {
    return 0;
  }

  const validMrr = Math.floor(mrrCents);
  return Math.floor((validMrr * CO_OP_ACCRUAL_RATE_PCT) / 100);
}

/**
 * Accrues monthly Co-Op marketing budget for an eligible partner.
 *
 * Validates partner profile, tier eligibility, ensures 90-day expiration,
 * and maintains idempotency against duplicate cycle months.
 *
 * @param db - D1Database instance.
 * @param partnerId - ID of partner profile.
 * @param cycleMonth - Billing cycle month in 'YYYY-MM' format.
 * @param mrrCents - Monthly gross MRR basis in cents.
 * @param overrideTier - Optional tier override for simulation/backfill.
 */
export async function accrueMonthlyCoOpBudget(
  db: D1Database,
  partnerId: string,
  cycleMonth: string,
  mrrCents: number,
  overrideTier?: PartnerTier,
): Promise<AccrueCoOpBudgetResult> {
  const trimmedCycle = cycleMonth?.trim();
  if (!trimmedCycle || !/^\d{4}-(0[1-9]|1[0-2])$/.test(trimmedCycle)) {
    return { success: false, allocatedCents: 0, error: 'INVALID_CYCLE_MONTH' };
  }

  if (mrrCents < 0 || !Number.isFinite(mrrCents)) {
    return { success: false, allocatedCents: 0, error: 'INVALID_MRR_AMOUNT' };
  }

  // 1. Fetch and verify partner
  const partner = await db
    .prepare('SELECT id, partner_name, tier, status FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerProfile>();

  if (!partner) {
    return { success: false, allocatedCents: 0, error: 'PARTNER_NOT_FOUND' };
  }

  if (partner.status !== 'active') {
    return {
      success: false,
      allocatedCents: 0,
      error: partner.status === 'suspended' ? 'PARTNER_SUSPENDED' : 'PARTNER_NOT_ACTIVE',
    };
  }

  const effectiveTier = overrideTier ?? partner.tier;

  // 2. Check tier eligibility
  if (effectiveTier !== 'GOLD' && effectiveTier !== 'PLATINUM') {
    return {
      success: false,
      allocatedCents: 0,
      error: 'TIER_NOT_ELIGIBLE_FOR_COOP',
    };
  }

  // 3. Check for existing allocation in this cycle (Idempotency)
  const existing = await db
    .prepare('SELECT * FROM co_op_budget_allocations WHERE partner_id = ? AND billing_cycle_month = ?')
    .bind(partnerId, trimmedCycle)
    .first<CoOpBudgetAllocation>();

  if (existing) {
    return {
      success: true,
      allocation: existing,
      allocatedCents: existing.allocated_cents,
      alreadyAccrued: true,
    };
  }

  // 4. Calculate 5% accrual
  const allocatedCents = calculateMonthlyCoOpAccrual(mrrCents, effectiveTier);
  const now = Date.now();
  const expiresAt = now + CO_OP_BUDGET_EXPIRY_MS;
  const allocationId = `coop_${crypto.randomUUID().slice(0, 16)}`;

  await db
    .prepare(`
      INSERT INTO co_op_budget_allocations (
        id, partner_id, billing_cycle_month, tier_at_time, mrr_basis_cents,
        accrual_rate_pct, allocated_cents, claimed_cents, remaining_cents,
        expires_at, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'active', ?, ?)
    `)
    .bind(
      allocationId,
      partnerId,
      trimmedCycle,
      effectiveTier,
      Math.floor(mrrCents),
      CO_OP_ACCRUAL_RATE_PCT,
      allocatedCents,
      allocatedCents,
      expiresAt,
      now,
      now,
    )
    .run();

  const createdAllocation: CoOpBudgetAllocation = {
    id: allocationId,
    partner_id: partnerId,
    billing_cycle_month: trimmedCycle,
    tier_at_time: effectiveTier as 'GOLD' | 'PLATINUM',
    mrr_basis_cents: Math.floor(mrrCents),
    accrual_rate_pct: CO_OP_ACCRUAL_RATE_PCT,
    allocated_cents: allocatedCents,
    claimed_cents: 0,
    remaining_cents: allocatedCents,
    expires_at: expiresAt,
    status: 'active',
    created_at: now,
    updated_at: now,
  };

  return {
    success: true,
    allocation: createdAllocation,
    allocatedCents,
    alreadyAccrued: false,
  };
}

/**
 * Automated Heuristic Appraisal Scoring for Co-Op Marketing Invoices (0 - 100 points).
 *
 * Scoring breakdown (4 criteria, 25 points each):
 * 1. Vendor Whitelist (25 points): Known ad network or corporate marketing agency.
 * 2. Date Alignment (25 points): Invoice date within billing cycle + 15 days grace.
 * 3. Proof of Execution & Brand Keywords (25 points): R2/file proof with Sophia brand alignment.
 * 4. Budget Solvency (25 points): Requested claim <= available uncommitted Co-Op budget.
 *
 * Auto-approval Gate:
 * - Score >= 85 AND Requested Amount <= $2,000 (200,000 cents) -> Auto-approved.
 * - Otherwise -> Routed to 'under_review' for manual compliance audit.
 */
export function auditCoOpClaimInvoice(input: InvoiceAppraisalInput): AuditCoOpClaimResult {
  const notes: string[] = [];
  const claimId = input.claimId ?? `claim_${crypto.randomUUID().slice(0, 16)}`;

  // --------------------------------------------------------------------------
  // Criterion 1: Vendor Whitelist Verification (+25 pts)
  // --------------------------------------------------------------------------
  let vendorVerified = false;
  const vendorCandidate = `${input.vendorName ?? ''} ${input.invoiceUrl ?? ''} ${input.notes ?? ''}`.toLowerCase();

  if (input.isWhitelistedVendor) {
    vendorVerified = true;
    notes.push('Vendor explicitly marked whitelisted.');
  } else {
    for (const net of VERIFIED_AD_NETWORKS) {
      if (vendorCandidate.includes(net)) {
        vendorVerified = true;
        notes.push(`Vendor verified against ad network whitelist: [${net}].`);
        break;
      }
    }
  }

  if (!vendorVerified) {
    notes.push('Vendor not recognized on verified ad network whitelist (-25 pts).');
  }

  // --------------------------------------------------------------------------
  // Criterion 2: Date Alignment within Billing Cycle + Grace Period (+25 pts)
  // --------------------------------------------------------------------------
  let dateValid = false;
  const now = Date.now();
  const invoiceDate = input.invoiceDate;

  if (input.periodStart && input.periodEnd) {
    const minAllowedDate = input.periodStart - CO_OP_GRACE_PERIOD_MS;
    const maxAllowedDate = input.periodEnd + CO_OP_GRACE_PERIOD_MS;
    dateValid = invoiceDate >= minAllowedDate && invoiceDate <= maxAllowedDate;
    if (dateValid) {
      notes.push('Invoice date falls within billing cycle window (+/- 15-day grace).');
    } else {
      notes.push('Invoice date falls outside billing cycle window (-25 pts).');
    }
  } else {
    // If explicit cycle dates are omitted, verify invoice was issued within the last 90 days and not in the future
    const maxPastWindow = now - CO_OP_BUDGET_EXPIRY_MS - CO_OP_GRACE_PERIOD_MS;
    const maxFutureWindow = now + 86_400 * 1000; // 1-day future clock skew
    dateValid = invoiceDate >= maxPastWindow && invoiceDate <= maxFutureWindow;
    if (dateValid) {
      notes.push('Invoice date within rolling 90-day window.');
    } else {
      notes.push('Invoice date expired (>90 days old) or invalid future date (-25 pts).');
    }
  }

  // --------------------------------------------------------------------------
  // Criterion 3: Campaign Proof & Brand Keywords (+25 pts)
  // --------------------------------------------------------------------------
  let proofProvided = false;
  const proofUrl = input.proofUrl ?? input.invoiceUrl;
  const hasProofFile = Boolean(proofUrl && proofUrl.trim().length > 5);

  const brandContext = `${input.campaignName ?? ''} ${input.notes ?? ''} ${(input.brandKeywords ?? []).join(' ')}`.toLowerCase();
  let hasBrandKeywords = false;
  for (const kw of SOPHIA_BRAND_KEYWORDS) {
    if (brandContext.includes(kw)) {
      hasBrandKeywords = true;
      break;
    }
  }

  // If proof file is attached AND brand keywords or referral tags are present
  if (hasProofFile && hasBrandKeywords) {
    proofProvided = true;
    notes.push('Campaign proof attached and verified with Sophia brand keywords.');
  } else if (!hasProofFile) {
    notes.push('Missing proof of campaign execution / invoice attachment (-25 pts).');
  } else {
    notes.push('Proof attached but lacking required Sophia brand keywords (-25 pts).');
  }

  // --------------------------------------------------------------------------
  // Criterion 4: Budget Solvency (+25 pts)
  // --------------------------------------------------------------------------
  const requestedCents = Math.floor(input.requestedAmountCents);
  const availableCents = Math.floor(input.availableBudgetCents);
  const budgetSufficient = requestedCents > 0 && requestedCents <= availableCents;

  if (budgetSufficient) {
    notes.push(`Budget solvent: requested $${(requestedCents / 100).toFixed(2)} <= available $${(availableCents / 100).toFixed(2)}.`);
  } else {
    notes.push(`Budget insolvent: requested $${(requestedCents / 100).toFixed(2)} > available $${(availableCents / 100).toFixed(2)} (-25 pts).`);
  }

  // --------------------------------------------------------------------------
  // Score Aggregation & Auto-Approval Gate
  // --------------------------------------------------------------------------
  const auditScore =
    (vendorVerified ? 25 : 0) +
    (dateValid ? 25 : 0) +
    (proofProvided ? 25 : 0) +
    (budgetSufficient ? 25 : 0);

  const amountEligible = requestedCents <= AUTO_APPROVAL_MAX_AMOUNT_CENTS;
  const isAutoApproved = auditScore >= AUTO_APPROVAL_SCORE_THRESHOLD && amountEligible && budgetSufficient;

  if (isAutoApproved) {
    notes.push('Auto-approval criteria met: Score >= 85 and Amount <= $2,000.');
  } else if (!amountEligible) {
    notes.push('Amount exceeds $2,000 threshold: escalated to manual compliance review.');
  } else {
    notes.push('Score below 85 threshold: routed to manual compliance review.');
  }

  return {
    claimId,
    auditScore,
    isAutoApproved,
    approvedAmountCents: isAutoApproved ? requestedCents : 0,
    breakdown: {
      vendorVerified,
      dateValid,
      proofProvided,
      budgetSufficient,
    },
    notes,
  };
}

/**
 * Submits a Co-Op marketing claim, checks solvency against active budget allocations,
 * performs automated invoice appraisal, and records the claim.
 */
export async function submitCoOpClaim(
  db: D1Database,
  input: SubmitCoOpClaimInput & {
    vendorName?: string;
    brandKeywords?: string[];
    periodStart?: number;
    periodEnd?: number;
    notes?: string;
    isWhitelistedVendor?: boolean;
  },
): Promise<SubmitCoOpClaimResult> {
  const partnerId = input.partnerId?.trim();
  const invoiceNumber = input.invoiceNumber?.trim();
  const invoiceUrl = input.invoiceUrl?.trim();
  const requestedCents = Math.floor(input.requestedAmountCents);

  if (!partnerId || !invoiceNumber || !invoiceUrl) {
    return { success: false, error: 'MISSING_REQUIRED_CLAIM_FIELDS' };
  }

  if (requestedCents <= 0 || !Number.isFinite(requestedCents)) {
    return { success: false, error: 'INVALID_CLAIM_AMOUNT' };
  }

  // 1. Verify partner exists and is active
  const partner = await db
    .prepare('SELECT id, partner_name, tier, status FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerProfile>();

  if (!partner) {
    return { success: false, error: 'PARTNER_NOT_FOUND' };
  }

  if (partner.status !== 'active') {
    return {
      success: false,
      error: partner.status === 'suspended' ? 'PARTNER_SUSPENDED' : 'PARTNER_NOT_ACTIVE',
    };
  }

  // 2. Idempotency Check: Reject duplicate invoice submission per partner
  const duplicate = await db
    .prepare('SELECT id FROM partner_co_op_claims WHERE partner_id = ? AND invoice_number = ?')
    .bind(partnerId, invoiceNumber)
    .first<{ id: string }>();

  if (duplicate) {
    return { success: false, error: 'DUPLICATE_INVOICE_SUBMISSION' };
  }

  // 3. Solvency Check: Find active, non-expired budget allocations for this partner
  const now = Date.now();
  const allocationsResult = await db
    .prepare(`
      SELECT * FROM co_op_budget_allocations
      WHERE partner_id = ? AND status = 'active' AND expires_at > ? AND remaining_cents > 0
      ORDER BY expires_at ASC
    `)
    .bind(partnerId, now)
    .all<CoOpBudgetAllocation>();

  const activeAllocations = allocationsResult.results ?? [];
  const totalAvailableCents = activeAllocations.reduce((sum, a) => sum + a.remaining_cents, 0);

  if (totalAvailableCents < requestedCents) {
    return { success: false, error: 'INSUFFICIENT_CO_OP_BUDGET' };
  }

  // Pick target allocation (earliest expiring with capacity, or first active)
  const targetAlloc =
    activeAllocations.find((a) => a.remaining_cents >= requestedCents) ?? activeAllocations[0];

  // 4. Run automated invoice appraisal scoring
  const appraisalInput: InvoiceAppraisalInput = {
    vendorName: input.vendorName,
    invoiceNumber: input.invoiceNumber,
    invoiceUrl: input.invoiceUrl,
    invoiceDate: input.invoiceDate,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    requestedAmountCents: requestedCents,
    availableBudgetCents: totalAvailableCents,
    campaignName: input.campaignName,
    brandKeywords: input.brandKeywords,
    notes: input.notes,
    isWhitelistedVendor: input.isWhitelistedVendor,
  };

  const auditResult = auditCoOpClaimInvoice(appraisalInput);
  const claimId = auditResult.claimId;
  const status: CoOpClaimStatus = auditResult.isAutoApproved ? 'approved' : 'under_review';
  const approvedAmountCents = auditResult.isAutoApproved ? requestedCents : 0;

  // 5. If auto-approved, deduct budget atomically from target allocation
  if (auditResult.isAutoApproved && targetAlloc) {
    await db
      .prepare(`
        UPDATE co_op_budget_allocations
        SET claimed_cents = claimed_cents + ?1,
            remaining_cents = remaining_cents - ?1,
            status = CASE WHEN remaining_cents - ?1 <= 0 THEN 'exhausted' ELSE 'active' END,
            updated_at = ?2
        WHERE id = ?3 AND remaining_cents >= ?1
      `)
      .bind(requestedCents, now, targetAlloc.id)
      .run();
  }

  // 6. Record claim entry in partner_co_op_claims
  await db
    .prepare(`
      INSERT INTO partner_co_op_claims (
        id, partner_id, budget_allocation_id, campaign_name, claim_type,
        invoice_number, invoice_url, invoice_date, requested_amount_cents,
        approved_amount_cents, reimbursement_currency, status, audit_score,
        audit_notes_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      claimId,
      partnerId,
      targetAlloc?.id ?? null,
      input.campaignName,
      input.claimType,
      invoiceNumber,
      invoiceUrl,
      input.invoiceDate,
      requestedCents,
      approvedAmountCents,
      input.reimbursementCurrency ?? 'USDT',
      status,
      auditResult.auditScore,
      JSON.stringify(auditResult.notes),
      now,
      now,
    )
    .run();

  const createdClaim: PartnerCoOpClaim = {
    id: claimId,
    partner_id: partnerId,
    budget_allocation_id: targetAlloc?.id ?? null,
    campaign_name: input.campaignName,
    claim_type: input.claimType,
    invoice_number: invoiceNumber,
    invoice_url: invoiceUrl,
    invoice_date: input.invoiceDate,
    requested_amount_cents: requestedCents,
    approved_amount_cents: approvedAmountCents,
    reimbursement_currency: input.reimbursementCurrency ?? 'USDT',
    status,
    audit_score: auditResult.auditScore,
    audit_notes_json: JSON.stringify(auditResult.notes),
    rejection_reason: null,
    payout_batch_id: null,
    reviewed_by: auditResult.isAutoApproved ? 'SYSTEM_AUTO_APPRAISER' : null,
    reviewed_at: auditResult.isAutoApproved ? now : null,
    paid_at: null,
    created_at: now,
    updated_at: now,
  };

  return {
    success: true,
    claim: createdClaim,
    auditResult,
  };
}

/**
 * Sweeps and reclaims expired unspent Co-Op budget allocations after 90 days.
 *
 * @param db - D1Database instance.
 * @param currentTimestampMs - Current timestamp in milliseconds (defaults to Date.now()).
 */
export async function sweepExpiredCoOpBudgets(
  db: D1Database,
  currentTimestampMs?: number,
): Promise<SweepExpiredBudgetsResult> {
  const cutoff = currentTimestampMs ?? Date.now();

  // Find all active allocations that have expired
  const expiredAllocations = await db
    .prepare(`
      SELECT id, remaining_cents
      FROM co_op_budget_allocations
      WHERE status = 'active' AND expires_at <= ?
    `)
    .bind(cutoff)
    .all<{ id: string; remaining_cents: number }>();

  const items = expiredAllocations.results ?? [];
  if (items.length === 0) {
    return { expiredCount: 0, reclaimedCents: 0 };
  }

  const reclaimedCents = items.reduce((sum, item) => sum + Math.max(0, item.remaining_cents), 0);

  // Transition status to 'expired'
  await db
    .prepare(`
      UPDATE co_op_budget_allocations
      SET status = 'expired', updated_at = ?1
      WHERE status = 'active' AND expires_at <= ?2
    `)
    .bind(cutoff, cutoff)
    .run();

  return {
    expiredCount: items.length,
    reclaimedCents,
  };
}

/**
 * Retrieves aggregated Co-Op marketing summary for a partner.
 */
export async function getPartnerCoOpSummary(
  db: D1Database,
  partnerId: string,
): Promise<PartnerCoOpSummary | null> {
  const partner = await db
    .prepare('SELECT id, partner_name, tier, status FROM partner_profiles WHERE id = ?')
    .bind(partnerId)
    .first<PartnerProfile>();

  if (!partner) {
    return null;
  }

  const isEligible = partner.tier === 'GOLD' || partner.tier === 'PLATINUM';
  const now = Date.now();

  const allocationsRes = await db
    .prepare('SELECT * FROM co_op_budget_allocations WHERE partner_id = ?')
    .bind(partnerId)
    .all<CoOpBudgetAllocation>();

  const allocations = allocationsRes.results ?? [];
  const activeAllocations = allocations.filter((a) => a.status === 'active' && a.expires_at > now);

  const totalAllocatedCents = allocations.reduce((sum, a) => sum + a.allocated_cents, 0);
  const totalClaimedCents = allocations.reduce((sum, a) => sum + a.claimed_cents, 0);
  const remainingActiveBudgetCents = activeAllocations.reduce((sum, a) => sum + a.remaining_cents, 0);

  const claimsRes = await db
    .prepare('SELECT status, approved_amount_cents FROM partner_co_op_claims WHERE partner_id = ?')
    .bind(partnerId)
    .all<{ status: CoOpClaimStatus; approved_amount_cents: number }>();

  const claims = claimsRes.results ?? [];
  const pendingClaimsCount = claims.filter(
    (c) => c.status === 'submitted' || c.status === 'under_review' || c.status === 'processing',
  ).length;
  const approvedClaimsCount = claims.filter((c) => c.status === 'approved' || c.status === 'paid').length;

  return {
    partnerId: partner.id,
    partnerName: partner.partner_name,
    tier: partner.tier,
    isEligible,
    accrualRatePct: isEligible ? CO_OP_ACCRUAL_RATE_PCT : 0,
    totalAllocatedCents,
    totalClaimedCents,
    remainingActiveBudgetCents,
    availableBudgetCents: remainingActiveBudgetCents,
    activeAllocationsCount: activeAllocations.length,
    pendingClaimsCount,
    approvedClaimsCount,
  };
}

/**
 * Retrieves budget allocations for a partner.
 */
export async function getPartnerCoOpAllocations(
  db: D1Database,
  partnerId: string,
): Promise<CoOpBudgetAllocation[]> {
  const result = await db
    .prepare('SELECT * FROM co_op_budget_allocations WHERE partner_id = ? ORDER BY created_at DESC')
    .bind(partnerId)
    .all<CoOpBudgetAllocation>();

  return result.results ?? [];
}

/**
 * Retrieves claims submitted by a partner with optional status filter.
 */
export async function getPartnerCoOpClaims(
  db: D1Database,
  partnerId: string,
  status?: CoOpClaimStatus,
): Promise<PartnerCoOpClaim[]> {
  if (status) {
    const result = await db
      .prepare('SELECT * FROM partner_co_op_claims WHERE partner_id = ? AND status = ? ORDER BY created_at DESC')
      .bind(partnerId, status)
      .all<PartnerCoOpClaim>();
    return result.results ?? [];
  }

  const result = await db
    .prepare('SELECT * FROM partner_co_op_claims WHERE partner_id = ? ORDER BY created_at DESC')
    .bind(partnerId)
    .all<PartnerCoOpClaim>();
  return result.results ?? [];
}

/**
 * Six-Nines (99.9999%) SLA Commitment & Automated Penalty Escrow Engine
 *
 * Implements:
 * - 99.9999% Ultra-SLA uptime calculations (exactly 2.592 seconds allowed monthly downtime)
 * - Microsecond error budget tracking and burn rate telemetry
 * - Tiered penalty schedule (None 0%, Minor 15%, Moderate 35%, Major 70%, Catastrophic 100%)
 * - Escrow lifecycle management (Funding, Breach evaluation, Penalty disbursement, Revenue release)
 * - Cryptographic SHA-256 audit attestation hash
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 *
 * @module tree/gpu/six-nines-sla-engine
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type SlaPenaltyEscrow,
  type SlaPenaltyEscrowDbRow,
  type SixNinesBreachTier,
  type EscrowStatus,
  type FundEscrowInput,
  type SixNinesSlaMetrics,
  type SixNinesEvaluationResult,
  type PenaltyClaimResult,
  type EscrowReleaseResult,
  GATE_10_CONSTANTS,
  BREACH_PENALTY_PCT,
  mapRowToSlaPenaltyEscrow,
  fundEscrowInputSchema,
} from '@/seed/types/edge-gpu-mesh';

// ============================================================================
// Cryptographic Hash & Calculation Helpers
// ============================================================================

/**
 * Computes a deterministic SHA-256 audit hash for an SLA escrow state.
 */
export async function generateEscrowAuditHash(payload: {
  tenantId: string;
  contractId: string;
  periodMonth: string;
  downtimeSeconds: number;
  balanceCents: number;
  breachTier: string;
}): Promise<string> {
  const canonicalString = [
    payload.tenantId,
    payload.contractId,
    payload.periodMonth,
    payload.downtimeSeconds.toFixed(4),
    payload.balanceCents.toString(),
    payload.breachTier,
  ].join('::');

  const encoder = new TextEncoder();
  const data = encoder.encode(canonicalString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Calculates Six-Nines (99.9999%) uptime metrics with millisecond/microsecond precision.
 *
 * In a standard 30-day month (2,592,000s):
 * Allowed Downtime = 2,592,000 * (1 - 0.999999) = 2.592 seconds.
 */
export function calculateSixNinesUptimeMetrics(
  downtimeSeconds: number,
  totalPeriodSeconds: number = GATE_10_CONSTANTS.MONTHLY_PERIOD_SECONDS,
): SixNinesSlaMetrics {
  const sanitizedDowntime = Math.max(0, Math.round(downtimeSeconds * 1000) / 1000);
  const totalSeconds = Math.max(1, totalPeriodSeconds);

  // Exact Six-Nines allowed error budget: 2.592s for 2,592,000s
  const errorBudgetAllocatedSeconds = Number(
    ((1 - GATE_10_CONSTANTS.SIX_NINES_SLA_PCT / 100) * totalSeconds).toFixed(4),
  );

  const uptimeSeconds = Math.max(0, totalSeconds - sanitizedDowntime);
  const actualUptimePct = Number(((uptimeSeconds / totalSeconds) * 100).toFixed(6));

  const errorBudgetConsumedSeconds = sanitizedDowntime;
  const errorBudgetRemainingSeconds = Number(
    Math.max(0, errorBudgetAllocatedSeconds - sanitizedDowntime).toFixed(4),
  );

  const errorBudgetBurnRatePct =
    errorBudgetAllocatedSeconds > 0
      ? Number(((sanitizedDowntime / errorBudgetAllocatedSeconds) * 100).toFixed(2))
      : 0.0;

  const { breachTier, penaltyPct } = determineSixNinesBreachTier(
    sanitizedDowntime,
    errorBudgetAllocatedSeconds,
  );

  return {
    targetSlaPct: GATE_10_CONSTANTS.SIX_NINES_SLA_PCT,
    actualUptimePct,
    totalPeriodSeconds: totalSeconds,
    allowedDowntimeSeconds: errorBudgetAllocatedSeconds,
    downtimeSeconds: sanitizedDowntime,
    errorBudgetAllocatedSeconds,
    errorBudgetConsumedSeconds,
    errorBudgetRemainingSeconds,
    errorBudgetBurnRatePct,
    breachTier,
    penaltyPct,
  };
}

/**
 * Determines SLA breach tier and tiered penalty percentage.
 *
 * Tiers:
 * - None: downtime <= 2.592s -> 0.0% penalty
 * - Minor: 2.592s < downtime <= 25.92s (5-nines tier) -> 15.0% penalty
 * - Moderate: 25.92s < downtime <= 259.2s (4-nines tier) -> 35.0% penalty
 * - Major: 259.2s < downtime <= 2,592s (3-nines tier) -> 70.0% penalty
 * - Catastrophic: downtime > 2,592s (> 43.2 min) -> 100.0% penalty
 */
export function determineSixNinesBreachTier(
  downtimeSeconds: number,
  allowedDowntimeSeconds: number = GATE_10_CONSTANTS.SIX_NINES_ALLOWED_DOWNTIME_SECONDS,
): { breachTier: SixNinesBreachTier; penaltyPct: number } {
  const roundedDowntime = Math.round(downtimeSeconds * 1000) / 1000;
  const roundedAllowed = Math.round(allowedDowntimeSeconds * 1000) / 1000;

  if (roundedDowntime <= roundedAllowed) {
    return { breachTier: 'none', penaltyPct: BREACH_PENALTY_PCT.none };
  }

  // Minor breach: > 2.592s and <= 25.92s
  if (roundedDowntime <= roundedAllowed * 10) {
    return { breachTier: 'minor', penaltyPct: BREACH_PENALTY_PCT.minor };
  }

  // Moderate breach: > 25.92s and <= 259.2s
  if (roundedDowntime <= roundedAllowed * 100) {
    return { breachTier: 'moderate', penaltyPct: BREACH_PENALTY_PCT.moderate };
  }

  // Major breach: > 259.2s and <= 2,592s
  if (roundedDowntime <= roundedAllowed * 1000) {
    return { breachTier: 'major', penaltyPct: BREACH_PENALTY_PCT.major };
  }

  // Catastrophic breach: > 2,592s
  return { breachTier: 'catastrophic', penaltyPct: BREACH_PENALTY_PCT.catastrophic };
}

// ============================================================================
// Service Operations
// ============================================================================

/**
 * Funds or deposits the monthly SLA penalty escrow guarantee fund for an enterprise contract.
 */
export async function fundSlaEscrow(
  db: D1Database,
  input: FundEscrowInput,
): Promise<SlaPenaltyEscrow> {
  const validated = fundEscrowInputSchema.parse(input);
  const now = Date.now();

  const depositPct = validated.depositPct ?? GATE_10_CONSTANTS.DEFAULT_ESCROW_DEPOSIT_PCT;
  const fundedCents = Math.round((validated.monthlyContractValueCents * depositPct) / 100);
  const escrowId = `esc_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;

  const auditHash = await generateEscrowAuditHash({
    tenantId: validated.tenantId,
    contractId: validated.contractId,
    periodMonth: validated.periodMonth,
    downtimeSeconds: 0.0,
    balanceCents: fundedCents,
    breachTier: 'none',
  });

  const stmt = db
    .prepare(
      `INSERT INTO sla_penalty_escrow (
        escrow_id, tenant_id, contract_id, period_month,
        target_sla_pct, actual_uptime_pct, total_period_seconds,
        allowed_downtime_seconds, downtime_seconds, error_budget_consumed_seconds,
        error_budget_remaining_seconds, escrow_funded_cents, penalty_claimed_cents,
        escrow_balance_cents, breach_tier, penalty_pct, escrow_status,
        audit_hash, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id, contract_id, period_month) DO UPDATE SET
        escrow_funded_cents = escrow_funded_cents + excluded.escrow_funded_cents,
        escrow_balance_cents = escrow_balance_cents + excluded.escrow_funded_cents,
        audit_hash = excluded.audit_hash,
        updated_at = excluded.updated_at`,
    )
    .bind(
      escrowId,
      validated.tenantId,
      validated.contractId,
      validated.periodMonth,
      GATE_10_CONSTANTS.SIX_NINES_SLA_PCT,
      100.0,
      GATE_10_CONSTANTS.MONTHLY_PERIOD_SECONDS,
      GATE_10_CONSTANTS.SIX_NINES_ALLOWED_DOWNTIME_SECONDS,
      0.0,
      0.0,
      GATE_10_CONSTANTS.SIX_NINES_ALLOWED_DOWNTIME_SECONDS,
      fundedCents,
      0,
      fundedCents,
      'none',
      0.0,
      'locked',
      auditHash,
      now,
      now,
    );

  await stmt.run();

  const row = await db
    .prepare(
      'SELECT * FROM sla_penalty_escrow WHERE tenant_id = ? AND contract_id = ? AND period_month = ?',
    )
    .bind(validated.tenantId, validated.contractId, validated.periodMonth)
    .first<SlaPenaltyEscrowDbRow>();

  if (!row) {
    throw new Error('Failed to retrieve newly funded SLA escrow ledger entry');
  }

  return mapRowToSlaPenaltyEscrow(row);
}

/**
 * Evaluates monthly Six-Nines SLA performance, records error budget consumption,
 * and updates escrow balance and breach tier.
 */
export async function evaluateSixNinesSlaPeriod(
  db: D1Database,
  tenantId: string,
  contractId: string,
  periodMonth: string,
  downtimeSeconds: number,
): Promise<SixNinesEvaluationResult> {
  const now = Date.now();

  let escrowRow = await db
    .prepare(
      'SELECT * FROM sla_penalty_escrow WHERE tenant_id = ? AND contract_id = ? AND period_month = ?',
    )
    .bind(tenantId, contractId, periodMonth)
    .first<SlaPenaltyEscrowDbRow>();

  // If no escrow pre-funded, automatically initialize standard enterprise deposit
  if (!escrowRow) {
    const defaultContractValue = 250_000; // $2,500.00 standard enterprise contract
    await fundSlaEscrow(db, {
      tenantId,
      contractId,
      periodMonth,
      monthlyContractValueCents: defaultContractValue,
    });
    escrowRow = await db
      .prepare(
        'SELECT * FROM sla_penalty_escrow WHERE tenant_id = ? AND contract_id = ? AND period_month = ?',
      )
      .bind(tenantId, contractId, periodMonth)
      .first<SlaPenaltyEscrowDbRow>();
  }

  if (!escrowRow) {
    throw new Error(`SLA Escrow record not found for tenant ${tenantId}, period ${periodMonth}`);
  }

  const existingEscrow = mapRowToSlaPenaltyEscrow(escrowRow);
  const metrics = calculateSixNinesUptimeMetrics(downtimeSeconds, existingEscrow.totalPeriodSeconds);

  const penaltyCents = Math.round(
    (existingEscrow.escrowFundedCents * metrics.penaltyPct) / 100,
  );
  const remainingBalanceCents = Math.max(0, existingEscrow.escrowFundedCents - penaltyCents);

  let newStatus: EscrowStatus = existingEscrow.escrowStatus;
  if (metrics.breachTier !== 'none') {
    newStatus = remainingBalanceCents === 0 ? 'fully_disbursed' : 'partially_disbursed';
  }

  const newAuditHash = await generateEscrowAuditHash({
    tenantId,
    contractId,
    periodMonth,
    downtimeSeconds: metrics.downtimeSeconds,
    balanceCents: remainingBalanceCents,
    breachTier: metrics.breachTier,
  });

  const lastBreachTs = metrics.breachTier !== 'none' ? now : existingEscrow.lastBreachTimestamp;

  await db
    .prepare(
      `UPDATE sla_penalty_escrow
       SET actual_uptime_pct = ?,
           downtime_seconds = ?,
           error_budget_consumed_seconds = ?,
           error_budget_remaining_seconds = ?,
           breach_tier = ?,
           penalty_pct = ?,
           escrow_balance_cents = ?,
           escrow_status = ?,
           last_breach_timestamp = ?,
           audit_hash = ?,
           updated_at = ?
       WHERE escrow_id = ?`,
    )
    .bind(
      metrics.actualUptimePct,
      metrics.downtimeSeconds,
      metrics.errorBudgetConsumedSeconds,
      metrics.errorBudgetRemainingSeconds,
      metrics.breachTier,
      metrics.penaltyPct,
      remainingBalanceCents,
      newStatus,
      lastBreachTs,
      newAuditHash,
      now,
      existingEscrow.escrowId,
    )
    .run();

  return {
    escrowId: existingEscrow.escrowId,
    tenantId,
    contractId,
    periodMonth,
    metrics,
    penaltyCents,
    escrowBalanceCents: remainingBalanceCents,
    breachTier: metrics.breachTier,
    evaluatedAt: now,
    auditHash: newAuditHash,
  };
}

/**
 * Claims accumulated penalty from the SLA escrow fund.
 */
export async function claimSlaPenalty(
  db: D1Database,
  escrowId: string,
): Promise<PenaltyClaimResult> {
  const now = Date.now();

  const escrowRow = await db
    .prepare('SELECT * FROM sla_penalty_escrow WHERE escrow_id = ?')
    .bind(escrowId)
    .first<SlaPenaltyEscrowDbRow>();

  if (!escrowRow) {
    throw new Error(`SLA Escrow not found: ${escrowId}`);
  }

  const escrow = mapRowToSlaPenaltyEscrow(escrowRow);
  if (escrow.breachTier === 'none' || escrow.penaltyPct === 0) {
    throw new Error('No SLA penalty available to claim for this period');
  }

  const penaltyToClaimCents = Math.round(
    (escrow.escrowFundedCents * escrow.penaltyPct) / 100,
  );
  const remainingEscrowCents = Math.max(0, escrow.escrowFundedCents - penaltyToClaimCents);
  const newStatus: EscrowStatus =
    remainingEscrowCents === 0 ? 'fully_disbursed' : 'partially_disbursed';

  const updatedAuditHash = await generateEscrowAuditHash({
    tenantId: escrow.tenantId,
    contractId: escrow.contractId,
    periodMonth: escrow.periodMonth,
    downtimeSeconds: escrow.downtimeSeconds,
    balanceCents: remainingEscrowCents,
    breachTier: escrow.breachTier,
  });

  await db
    .prepare(
      `UPDATE sla_penalty_escrow
       SET penalty_claimed_cents = ?,
           escrow_balance_cents = ?,
           escrow_status = ?,
           audit_hash = ?,
           updated_at = ?
       WHERE escrow_id = ?`,
    )
    .bind(
      penaltyToClaimCents,
      remainingEscrowCents,
      newStatus,
      updatedAuditHash,
      now,
      escrowId,
    )
    .run();

  return {
    escrowId,
    tenantId: escrow.tenantId,
    claimedCents: penaltyToClaimCents,
    remainingEscrowCents,
    status: newStatus,
    claimedAt: now,
  };
}

/**
 * Releases unpenalized escrow fund to recognized enterprise revenue upon clean period close.
 */
export async function releaseEscrowToRevenue(
  db: D1Database,
  escrowId: string,
): Promise<EscrowReleaseResult> {
  const now = Date.now();

  const escrowRow = await db
    .prepare('SELECT * FROM sla_penalty_escrow WHERE escrow_id = ?')
    .bind(escrowId)
    .first<SlaPenaltyEscrowDbRow>();

  if (!escrowRow) {
    throw new Error(`SLA Escrow not found: ${escrowId}`);
  }

  const escrow = mapRowToSlaPenaltyEscrow(escrowRow);
  if (escrow.escrowStatus === 'released_to_revenue') {
    throw new Error(`Escrow ${escrowId} has already been released to revenue`);
  }

  const releasedCents = escrow.escrowBalanceCents;
  if (releasedCents === 0) {
    throw new Error(`Escrow ${escrowId} has 0 remaining balance to release`);
  }

  const updatedAuditHash = await generateEscrowAuditHash({
    tenantId: escrow.tenantId,
    contractId: escrow.contractId,
    periodMonth: escrow.periodMonth,
    downtimeSeconds: escrow.downtimeSeconds,
    balanceCents: 0,
    breachTier: escrow.breachTier,
  });

  await db
    .prepare(
      `UPDATE sla_penalty_escrow
       SET escrow_balance_cents = 0,
           escrow_status = 'released_to_revenue',
           audit_hash = ?,
           updated_at = ?
       WHERE escrow_id = ?`,
    )
    .bind(updatedAuditHash, now, escrowId)
    .run();

  return {
    escrowId,
    releasedCents,
    status: 'released_to_revenue',
    releasedAt: now,
  };
}

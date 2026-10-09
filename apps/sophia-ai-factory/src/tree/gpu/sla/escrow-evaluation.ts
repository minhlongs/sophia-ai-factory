/**
 * SLA Performance Period Evaluation Operations
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module tree/gpu/sla/escrow-evaluation
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type SlaPenaltyEscrowDbRow,
  type EscrowStatus,
  type SixNinesEvaluationResult,
  mapRowToSlaPenaltyEscrow,
} from '@/seed/types/edge-gpu-mesh';
import { generateEscrowAuditHash } from './crypto-hasher';
import { calculateSixNinesUptimeMetrics } from './metrics-calculator';
import { fundSlaEscrow } from './escrow-funding';

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

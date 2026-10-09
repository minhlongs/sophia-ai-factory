/**
 * SLA Penalty Escrow Funding Operations
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module tree/gpu/sla/escrow-funding
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type SlaPenaltyEscrow,
  type SlaPenaltyEscrowDbRow,
  type FundEscrowInput,
  GATE_10_CONSTANTS,
  mapRowToSlaPenaltyEscrow,
  fundEscrowInputSchema,
} from '@/seed/types/edge-gpu-mesh';
import { generateEscrowAuditHash } from './crypto-hasher';

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

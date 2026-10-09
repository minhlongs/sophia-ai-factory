/**
 * SLA Penalty Claim & Revenue Release Settlement Operations
 *
 * Layer: tree/gpu (Domain engine — imports ONLY from @/seed)
 * Conforms to: Sophia 4-Layer Architecture Doctrine (< 200 LOC)
 *
 * @module tree/gpu/sla/escrow-settlement
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type SlaPenaltyEscrowDbRow,
  type EscrowStatus,
  type PenaltyClaimResult,
  type EscrowReleaseResult,
  mapRowToSlaPenaltyEscrow,
} from '@/seed/types/edge-gpu-mesh';
import { generateEscrowAuditHash } from './crypto-hasher';

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

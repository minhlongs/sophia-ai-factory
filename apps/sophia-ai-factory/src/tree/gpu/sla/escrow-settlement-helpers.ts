/**
 * SLA Escrow Lookup & Audit Hash Helpers for Settlement Operations
 *
 * Layer: tree/gpu/sla
 * @module tree/gpu/sla/escrow-settlement-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import {
  type SlaPenaltyEscrowDbRow,
  type SlaPenaltyEscrow,
  mapRowToSlaPenaltyEscrow,
} from '@/seed/types/edge-gpu-mesh';
import { generateEscrowAuditHash } from './crypto-hasher';

export async function fetchEscrowOrThrow(
  db: D1Database,
  escrowId: string,
): Promise<SlaPenaltyEscrow> {
  const escrowRow = await db
    .prepare('SELECT * FROM sla_penalty_escrow WHERE escrow_id = ?')
    .bind(escrowId)
    .first<SlaPenaltyEscrowDbRow>();

  if (!escrowRow) {
    throw new Error(`SLA Escrow not found: ${escrowId}`);
  }

  return mapRowToSlaPenaltyEscrow(escrowRow);
}

export async function computeUpdatedEscrowAuditHash(
  escrow: SlaPenaltyEscrow,
  balanceCents: number,
): Promise<string> {
  return generateEscrowAuditHash({
    tenantId: escrow.tenantId,
    contractId: escrow.contractId,
    periodMonth: escrow.periodMonth,
    downtimeSeconds: escrow.downtimeSeconds,
    balanceCents,
    breachTier: escrow.breachTier,
  });
}

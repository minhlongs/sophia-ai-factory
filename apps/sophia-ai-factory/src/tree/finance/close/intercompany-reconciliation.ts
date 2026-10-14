/**
 * Intercompany Transfer Reconciliation & Filtered Query Helpers
 * @module tree/finance/close/intercompany-reconciliation
 */

import type { D1Database } from '@/seed/db/client';
import type {
  IntercompanyTransfer,
  IntercompanyEntity,
  SettlementStatus,
} from '@/seed/types/financial-close';
import { appendIpoAuditEvent } from '@/tree/finance/merkle-audit-vault';
import type { RawTransferRow } from './types';
import { mapRowToTransfer } from './period-mappers';

/**
 * Reconcile and approve an intercompany transfer
 */
export async function reconcileIntercompanyTransfer(
  db: D1Database,
  transferId: string,
  approvedBy: string,
  notes?: string,
): Promise<IntercompanyTransfer> {
  const existing = await db
    .prepare(`SELECT * FROM intercompany_transfers WHERE id = ?1 LIMIT 1`)
    .bind(transferId)
    .first<RawTransferRow>();

  if (!existing) {
    throw new Error(`Intercompany transfer ${transferId} not found`);
  }

  const now = Date.now();

  await db
    .prepare(
      `UPDATE intercompany_transfers
       SET settlement_status = 'reconciled',
           approved_by = ?1,
           settled_at = ?2,
           notes = COALESCE(?3, notes),
           updated_at = ?4
       WHERE id = ?5`,
    )
    .bind(approvedBy, now, notes ?? null, now, transferId)
    .run();

  const periodKey = existing.transfer_date.substring(0, 7);

  await appendIpoAuditEvent(db, {
    periodKey,
    eventType: 'INTERCOMPANY_RECONCILED',
    eventScope: 'consolidated_group',
    actorId: approvedBy,
    actorRole: 'CFO',
    amountCents: existing.gross_amount_cents,
    payload: {
      transferId,
      transferReference: existing.transfer_reference,
      reconciledAt: now,
      notes: notes ?? null,
    },
    soxControlId: 'AC-6.2',
    vasAccountCode: '336',
  });

  const updated = await db
    .prepare(`SELECT * FROM intercompany_transfers WHERE id = ?1 LIMIT 1`)
    .bind(transferId)
    .first<RawTransferRow>();

  if (!updated) throw new Error(`Intercompany transfer ${transferId} disappeared`);
  return mapRowToTransfer(updated);
}

/**
 * List intercompany transfers with optional filters
 */
export async function listIntercompanyTransfers(
  db: D1Database,
  options?: {
    originEntity?: IntercompanyEntity;
    destinationEntity?: IntercompanyEntity;
    status?: SettlementStatus;
    fromDate?: string;
    toDate?: string;
  },
): Promise<IntercompanyTransfer[]> {
  let query = `SELECT * FROM intercompany_transfers WHERE 1=1`;
  const params: unknown[] = [];
  if (options?.originEntity) {
    params.push(options.originEntity);
    query += ` AND origin_entity = ?${params.length}`;
  }
  if (options?.destinationEntity) {
    params.push(options.destinationEntity);
    query += ` AND destination_entity = ?${params.length}`;
  }
  if (options?.status) {
    params.push(options.status);
    query += ` AND settlement_status = ?${params.length}`;
  }
  if (options?.fromDate) {
    params.push(options.fromDate);
    query += ` AND transfer_date >= ?${params.length}`;
  }
  if (options?.toDate) {
    params.push(options.toDate);
    query += ` AND transfer_date <= ?${params.length}`;
  }
  query += ` ORDER BY transfer_date DESC, created_at DESC`;
  const { results } = await db.prepare(query).bind(...params).all<RawTransferRow>();
  return (results ?? []).map(mapRowToTransfer);
}

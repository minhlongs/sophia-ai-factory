/**
 * Intercompany Transfer Recording & Reconciliation Service
 * Layer: tree/finance
 *
 * @module tree/finance/close/intercompany-service
 */

import type { D1Database } from '@/seed/db/client';
import type {
  IntercompanyTransfer,
  RecordTransferInput,
  IntercompanyEntity,
  SettlementStatus,
} from '@/seed/types/financial-close';
import { appendIpoAuditEvent } from '@/tree/finance/merkle-audit-vault';
import type { RawTransferRow } from './types';
import { calculateWithholdingTax } from './tax-calculator';
import { mapRowToTransfer } from './period-mappers';

/**
 * Record a cross-border intercompany transfer with statutory withholding tax calculation
 */
export async function recordIntercompanyTransfer(
  db: D1Database,
  input: RecordTransferInput,
  actorId: string = 'SYSTEM'
): Promise<IntercompanyTransfer> {
  const { ratePct, taxCents, netCents } = calculateWithholdingTax(
    input.withholdingTaxRegime,
    input.grossAmountCents
  );

  const id = crypto.randomUUID().replace(/-/g, '').toLowerCase();
  const refNum = Math.floor(1000 + Math.random() * 9000);
  const transferReference = `ICT-${input.transferDate.substring(0, 7)}-${refNum}`;
  const currency = input.currency ?? 'USD';
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO intercompany_transfers (
        id, transfer_reference, origin_entity, destination_entity, transfer_type,
        currency, gross_amount_cents, withholding_tax_regime, withholding_tax_rate_pct,
        withholding_tax_amount_cents, net_settlement_cents, settlement_status,
        transfer_date, supporting_docs_hash, notes, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'pending', ?12, ?13, ?14, ?15, ?16)`
    )
    .bind(
      id,
      transferReference,
      input.originEntity,
      input.destinationEntity,
      input.transferType,
      currency,
      input.grossAmountCents,
      input.withholdingTaxRegime,
      ratePct,
      taxCents,
      netCents,
      input.transferDate,
      input.supportingDocsHash ?? null,
      input.notes ?? null,
      now,
      now
    )
    .run();

  const periodKey = input.transferDate.substring(0, 7);

  await appendIpoAuditEvent(db, {
    periodKey,
    eventType: 'INTERCOMPANY_TRANSFER_POSTED',
    eventScope: 'consolidated_group',
    actorId,
    actorRole: 'CONTROLLER',
    amountCents: input.grossAmountCents,
    payload: {
      transferId: id,
      transferReference,
      origin: input.originEntity,
      destination: input.destinationEntity,
      grossCents: input.grossAmountCents,
      taxCents,
      netCents,
    },
    soxControlId: 'AC-6.2',
    vasAccountCode: '136',
  });

  const row = await db
    .prepare(`SELECT * FROM intercompany_transfers WHERE id = ?1 LIMIT 1`)
    .bind(id)
    .first<RawTransferRow>();

  if (!row) throw new Error(`Failed to create intercompany transfer ${id}`);
  return mapRowToTransfer(row);
}

/**
 * Reconcile and approve an intercompany transfer
 */
export async function reconcileIntercompanyTransfer(
  db: D1Database,
  transferId: string,
  approvedBy: string,
  notes?: string
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
       WHERE id = ?5`
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
  }
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

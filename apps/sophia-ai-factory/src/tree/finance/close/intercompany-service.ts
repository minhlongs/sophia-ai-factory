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
} from '@/seed/types/financial-close';
import { appendIpoAuditEvent } from '@/tree/finance/merkle-audit-vault';
import type { RawTransferRow } from './types';
import { calculateWithholdingTax } from './tax-calculator';
import { mapRowToTransfer } from './period-mappers';

export {
  reconcileIntercompanyTransfer,
  listIntercompanyTransfers,
} from './intercompany-reconciliation';

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

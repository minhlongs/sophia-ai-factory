import type { D1Database } from '@cloudflare/workers-types';
import type {
  PartnerCrossBorderLedgerEntry,
  RecordCrossBorderCommissionInput,
} from '@/seed/types/cross-border-ledger';
import { calculateCrossBorderPayout } from './calculator';
import {
  getCrossBorderLedgerByPartner,
  getCrossBorderLedgerSummary,
} from './d1-ledger-queries';

export { getCrossBorderLedgerByPartner, getCrossBorderLedgerSummary };

/**
 * Record a cross-border commission and write the ledger record to Cloudflare D1.
 */
export async function recordCrossBorderCommission(
  db: D1Database,
  input: RecordCrossBorderCommissionInput,
): Promise<PartnerCrossBorderLedgerEntry> {
  const { tax, payout } = calculateCrossBorderPayout({
    grossCents: input.grossCents,
    jurisdiction: input.whtJurisdiction,
    targetCurrency: input.payoutCurrency,
    baseFxRate: input.baseFxRate,
    hedgingBufferPct: input.hedgingBufferPct,
    isIndividual: input.isIndividual,
    certificateStatus: input.taxCertificateStatus,
    customTreatyRatePct: input.customTreatyRatePct,
    taxIdNumber: input.taxIdNumber,
  });

  const id = `cb_ledger_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const now = Date.now();

  const entry: PartnerCrossBorderLedgerEntry = {
    id,
    partner_id: input.partnerId,
    order_id: input.orderId,
    payout_batch_id: null,
    gross_commission_cents: tax.grossCents,
    wht_jurisdiction: input.whtJurisdiction,
    wht_rate_pct: tax.ratePct,
    wht_amount_cents: tax.withholdingCents,
    net_commission_cents: tax.netCents,
    payout_currency: input.payoutCurrency,
    applied_fx_rate: payout.effectiveFxRate,
    hedging_buffer_pct: payout.hedgingBufferPct,
    net_payout_local_amount: payout.localPayoutAmount,
    tax_id_number: input.taxIdNumber ?? null,
    tax_certificate_status: tax.certificateStatus,
    status: 'accrued',
    created_at: now,
    settled_at: null,
  };

  await db
    .prepare(
      `INSERT INTO partner_cross_border_ledger (
        id, partner_id, order_id, payout_batch_id,
        gross_commission_cents, wht_jurisdiction, wht_rate_pct, wht_amount_cents,
        net_commission_cents, payout_currency, applied_fx_rate, hedging_buffer_pct,
        net_payout_local_amount, tax_id_number, tax_certificate_status, status,
        created_at, settled_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      entry.id,
      entry.partner_id,
      entry.order_id,
      entry.payout_batch_id,
      entry.gross_commission_cents,
      entry.wht_jurisdiction,
      entry.wht_rate_pct,
      entry.wht_amount_cents,
      entry.net_commission_cents,
      entry.payout_currency,
      entry.applied_fx_rate,
      entry.hedging_buffer_pct,
      entry.net_payout_local_amount,
      entry.tax_id_number,
      entry.tax_certificate_status,
      entry.status,
      entry.created_at,
      entry.settled_at
    )
    .run();

  return entry;
}

/**
 * Settle a cross-border ledger commission entry by linking to a payout batch.
 */
export async function settleCrossBorderPayout(
  db: D1Database,
  ledgerId: string,
  batchId: string,
): Promise<PartnerCrossBorderLedgerEntry> {
  const now = Date.now();

  const updateResult = await db
    .prepare(
      `UPDATE partner_cross_border_ledger
       SET status = 'settled', payout_batch_id = ?, settled_at = ?
       WHERE id = ? AND status = 'accrued'`
    )
    .bind(batchId, now, ledgerId)
    .run();

  if (updateResult.meta.changes === 0) {
    throw new Error(`Ledger entry ${ledgerId} not found or not in 'accrued' state for settlement`);
  }

  const updated = await db
    .prepare(`SELECT * FROM partner_cross_border_ledger WHERE id = ?`)
    .bind(ledgerId)
    .first<PartnerCrossBorderLedgerEntry>();

  if (!updated) {
    throw new Error(`Failed to retrieve settled ledger entry ${ledgerId}`);
  }

  return updated;
}

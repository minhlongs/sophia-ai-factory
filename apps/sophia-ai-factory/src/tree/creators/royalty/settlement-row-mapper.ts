/**
 * Creator Royalty Settlement Row Mapper & D1 Persistence.
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/settlement-row-mapper
 */

import type { D1Database } from '@/seed/db/client';
import type {
  ContractorTaxRegime,
  CreatorRoyaltySettlement,
  SettlementCurrency,
  SettlementPayoutRail,
  SettlementStatus,
} from '@/seed/types/creator-dao-c2pa';
import type { SettlementDbRow } from './types';

export function mapSettlementRow(
  row: SettlementDbRow,
): CreatorRoyaltySettlement {
  return {
    id: row.id,
    settlementReference: row.settlement_reference,
    contractId: row.contract_id,
    creatorId: row.creator_id,
    templateId: row.template_id,
    batchId: row.batch_id,
    grossRoyaltyCents: row.gross_royalty_cents,
    creatorGrossShareCents: row.gross_royalty_cents,
    platformShareCents: row.platform_fee_cents,
    platformFeeCents: row.platform_fee_cents,
    daoTreasuryCents: row.dao_treasury_cents,
    contractorTaxRegime: row.contractor_tax_regime as ContractorTaxRegime,
    taxWithholdingRatePct: row.tax_withholding_rate_pct,
    taxWithheldCents: row.tax_withheld_cents,
    railFeeCents: row.rail_fee_cents,
    netPayableCents: row.net_payable_cents,
    netPayoutCents: row.net_payable_cents,
    payoutRail: row.payout_rail as SettlementPayoutRail,
    settlementCurrency: row.settlement_currency as SettlementCurrency,
    settlementAmount: row.settlement_amount,
    fxRateApplied: row.fx_rate_applied,
    destinationAddress: row.destination_address,
    destinationBankBin: row.destination_bank_bin,
    destinationName: row.destination_name,
    status: row.status as SettlementStatus,
    txHash: row.tx_hash,
    qrPayload: row.qr_payload,
    idempotencyKey: row.idempotency_key,
    failureReason: row.failure_reason,
    settledAt: row.settled_at,
    metadataJson: row.metadata_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function insertSettlementRow(
  db: D1Database,
  record: CreatorRoyaltySettlement,
  idempotencyKey: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO creator_royalty_settlements (
        id, settlement_reference, contract_id, creator_id, template_id, batch_id,
        gross_royalty_cents, platform_fee_cents, dao_treasury_cents, contractor_tax_regime,
        tax_withholding_rate_pct, tax_withheld_cents, rail_fee_cents, net_payable_cents,
        payout_rail, settlement_currency, settlement_amount, fx_rate_applied, destination_address,
        destination_bank_bin, destination_name, status, idempotency_key, qr_payload, metadata_json,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`,
    )
    .bind(
      record.id,
      record.settlementReference,
      record.contractId,
      record.creatorId,
      record.templateId ?? null,
      record.batchId ?? null,
      record.grossRoyaltyCents,
      record.platformFeeCents,
      record.daoTreasuryCents,
      record.contractorTaxRegime,
      record.taxWithholdingRatePct,
      record.taxWithheldCents,
      record.netPayableCents,
      record.payoutRail,
      record.settlementCurrency,
      record.settlementAmount,
      record.fxRateApplied,
      record.destinationAddress,
      record.destinationBankBin,
      record.destinationName,
      idempotencyKey,
      record.qrPayload,
      record.metadataJson,
      record.createdAt,
      record.updatedAt,
    )
    .run();
}

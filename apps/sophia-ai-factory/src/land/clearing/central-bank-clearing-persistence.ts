/**
 * D1 Persistence Helpers for Central Bank ISO 20022 Clearing & RTGS Netting.
 * @module land/clearing/central-bank-clearing-persistence
 */

import type { D1Database } from '@cloudflare/workers-types';

export interface Pacs009PersistInput {
  messageId: string;
  messageType?: string;
  endToEndId: string;
  uetr: string;
  instructingBic: string;
  instructedBic: string;
  currency: string;
  amountCents: number;
  settlementDate: string;
  rawXml: string;
  digest: string;
}

export async function insertPacs009MessageRow(
  db: D1Database,
  input: Pacs009PersistInput,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO iso20022_pacs_messages (
        id, message_definition_id, end_to_end_id, uetr, instructing_agent_bic,
        instructed_agent_bic, settlement_currency, interbank_settlement_amount_cents,
        settlement_date, charge_bearer, raw_xml_payload, signature_digest_hex, verification_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.messageId,
      input.messageType,
      input.endToEndId,
      input.uetr,
      input.instructingBic,
      input.instructedBic,
      input.currency,
      input.amountCents,
      input.settlementDate,
      'SHAR',
      input.rawXml,
      input.digest,
      'SETTLED',
    )
    .run();
}

export async function insertRtgsSettlementBatchRow(
  db: D1Database,
  batchRef: string,
  grossVolumeCents: number,
  netVolumeCents: number,
  compressionRatioPercentage: number,
  obligationsCount: number,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO rtgs_settlement_batches (
        id, batch_reference, cycle_number, total_gross_volume_cents,
        total_net_volume_cents, compression_ratio_percentage,
        settled_transactions_count, batch_status, merkle_root_hex, executed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      `rtgs_${batchRef}`,
      batchRef,
      1,
      grossVolumeCents,
      netVolumeCents,
      compressionRatioPercentage,
      obligationsCount,
      'COMPLETED',
      '0x_netting_merkle_root',
      new Date().toISOString(),
    )
    .run();
}

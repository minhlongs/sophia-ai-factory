'use server';

/**
 * central-bank-clearing-actions.ts — Gate 12 Land Layer Server Actions
 * Central Bank ISO 20022 High-Value Payment & Clearing Actions
 */

import { getD1 } from '@/seed/db/client';
import {
  generatePacs009Xml,
  parseAndValidateIso20022Xml,
  computeIso20022Digest,
} from '@/tree/clearing/iso20022-clearing-engine';
import {
  calculateMultilateralNetting,
  type InterbankObligation,
} from '@/tree/clearing/rtgs-settlement-vault';
import type { CentralBankClearingNode } from '@/seed/types/central-bank-clearing';

export interface SubmitPacs009ActionParams {
  endToEndId: string;
  uetr: string;
  instructingBic: string;
  instructedBic: string;
  amountCents: number;
  currency: string;
  settlementDate: string;
}

export interface Pacs009ActionResult {
  success: boolean;
  messageId?: string;
  digest?: string;
  error?: string;
}

export async function submitPacs009PaymentAction(
  params: SubmitPacs009ActionParams,
): Promise<Pacs009ActionResult> {
  try {
    const rawXml = generatePacs009Xml(params);
    const parsed = parseAndValidateIso20022Xml(rawXml);

    if (!parsed.isValid) {
      return { success: false, error: parsed.error || 'Invalid ISO 20022 XML generated' };
    }

    const digest = computeIso20022Digest(rawXml);
    const db = await getD1();

    if (db) {
      const messageId = `msg_${params.endToEndId}`;
      await db
        .prepare(
          `INSERT INTO iso20022_pacs_messages (
            id, message_definition_id, end_to_end_id, uetr, instructing_agent_bic,
            instructed_agent_bic, settlement_currency, interbank_settlement_amount_cents,
            settlement_date, charge_bearer, raw_xml_payload, signature_digest_hex, verification_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          messageId,
          parsed.messageType,
          params.endToEndId,
          params.uetr,
          params.instructingBic,
          params.instructedBic,
          params.currency,
          params.amountCents,
          params.settlementDate,
          'SHAR',
          rawXml,
          digest,
          'SETTLED',
        )
        .run();

      return {
        success: true,
        messageId,
        digest,
      };
    }

    return {
      success: true,
      messageId: `sim_${params.endToEndId}`,
      digest,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function executeRtgsNettingBatchAction(
  obligations: InterbankObligation[],
  clearingNodes: Record<string, CentralBankClearingNode>,
) {
  try {
    const nettingResult = calculateMultilateralNetting(obligations, clearingNodes);
    const db = await getD1();

    if (db && nettingResult.settlementFeasible) {
      const batchRef = `BATCH_${Date.now()}`;
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
          nettingResult.grossVolumeCents,
          nettingResult.netVolumeCents,
          nettingResult.compressionRatioPercentage,
          obligations.length,
          'COMPLETED',
          '0x_netting_merkle_root',
          new Date().toISOString(),
        )
        .run();
    }

    return {
      success: true,
      data: nettingResult,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

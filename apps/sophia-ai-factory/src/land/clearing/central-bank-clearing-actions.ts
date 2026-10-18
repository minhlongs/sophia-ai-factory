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
import {
  insertPacs009MessageRow,
  insertRtgsSettlementBatchRow,
} from './central-bank-clearing-persistence';

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
      await insertPacs009MessageRow(db, {
        messageId,
        messageType: parsed.messageType,
        endToEndId: params.endToEndId,
        uetr: params.uetr,
        instructingBic: params.instructingBic,
        instructedBic: params.instructedBic,
        currency: params.currency,
        amountCents: params.amountCents,
        settlementDate: params.settlementDate,
        rawXml,
        digest,
      });

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
      await insertRtgsSettlementBatchRow(
        db,
        batchRef,
        nettingResult.grossVolumeCents,
        nettingResult.netVolumeCents,
        nettingResult.compressionRatioPercentage,
        obligations.length,
      );
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

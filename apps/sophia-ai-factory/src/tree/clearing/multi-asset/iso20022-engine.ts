/**
 * ISO 20022 Financial Messaging Engine (pacs.008 & camt.053)
 * Layer: tree/clearing
 *
 * @module tree/clearing/multi-asset/iso20022-engine
 */

import type {
  CrossBorderClearingBatch,
  Iso20022Pacs008Message,
  Iso20022Camt053Message,
} from '@/seed/types/multi-asset-clearing';
import { normalizeAssetAmount } from './currency-precision';

/**
 * Generates ISO 20022 pacs.008.001.10 Financial Credit Transfer message.
 */
export function generatePacs008Message(
  batch: CrossBorderClearingBatch,
  debtorName: string = 'Sophia Sovereign Clearing Vault',
  creditorName: string = 'Authorized Participant Settlement Entity'
): Iso20022Pacs008Message {
  const now = new Date(batch.settledAt ?? Date.now());
  const creationDateTime = now.toISOString();
  const settlementDate = creationDateTime.slice(0, 10);
  const uetr = (batch.metadata.uetr as string) || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : batch.batchReference);

  return {
    messageDefinitionIdentifier: 'pacs.008.001.10',
    groupHeader: {
      messageId: batch.iso20022MessageId ?? `urn:iso:std:iso:20022:tech:xsd:pacs.008.001.10:${uetr}`,
      creationDateTime,
      numberOfTransactions: 1,
      settlementInformation: {
        settlementMethod: 'CLRG',
        clearingSystem: 'SOPHIA-RTGS-MESH',
      },
    },
    creditTransferTransactionInformation: {
      paymentIdentification: {
        instructionId: batch.id,
        endToEndId: batch.batchReference,
        uetr,
      },
      interbankSettlementAmount: {
        currency: batch.targetAsset,
        amount: batch.netClearedAmount,
      },
      interbankSettlementDate: settlementDate,
      chargeBearer: 'SHAR',
      debtor: {
        name: debtorName,
        identification: 'VAULT-SOPHIA-001',
      },
      creditor: {
        name: creditorName,
        identification: (batch.bankingPartnerRef as string) || 'EXT-BENEFICIARY-001',
      },
      remittanceInformation: {
        unstructured: `T+0 RTGS Clearing Settlement Ref: ${batch.batchReference}`,
      },
    },
  };
}

/**
 * Generates ISO 20022 camt.053.001.10 Bank-to-Customer Statement message.
 */
export function generateCamt053Statement(
  batches: CrossBorderClearingBatch[],
  accountId: string = 'ACCOUNT-SOPHIA-TREASURY'
): Iso20022Camt053Message {
  const now = new Date().toISOString();
  const entries = batches.map((batch) => ({
    entryReference: batch.batchReference,
    amount: batch.netClearedAmount,
    currency: batch.targetAsset,
    creditDebitIndicator: 'CRDT' as const,
    status: 'BOOK' as const,
    bookingDate: new Date(batch.settledAt ?? Date.now()).toISOString().slice(0, 10),
    bankTransactionCode: 'PMNT-ICDT-ESCT',
    proprietaryRef: batch.bankingPartnerRef || batch.id,
  }));

  const totalBalance = batches.reduce((sum, b) => sum + b.netClearedAmount, 0);

  return {
    messageDefinitionIdentifier: 'camt.053.001.10',
    groupHeader: {
      messageId: `STATEMENT-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      creationDateTime: now,
      accountServicer: 'Sophia Central Clearing Mesh',
    },
    statement: {
      statementId: `STMT-${Date.now()}`,
      electronicSequenceNumber: 1,
      creationDateTime: now,
      accountIdentification: accountId,
      balance: {
        type: 'CLBD',
        amount: normalizeAssetAmount(totalBalance, batches[0]?.targetAsset ?? 'USDT'),
        currency: batches[0]?.targetAsset ?? 'USDT',
        date: now.slice(0, 10),
      },
      entries,
    },
  };
}

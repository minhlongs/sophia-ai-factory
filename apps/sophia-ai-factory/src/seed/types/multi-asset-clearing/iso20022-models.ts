/**
 * ISO 20022 Financial Messages & Multilateral Netting Models
 *
 * Layer: seed/types
 */

import type { ClearingAsset } from './constants-enums';

export type {
  SwarmNodeHealth,
  PartitionArbitrationResult,
  ConsensusCommitResult,
  PbftPhase,
  PbftMessage,
} from './clearing-consensus-models';

export interface Iso20022Pacs008Message {
  messageDefinitionIdentifier: 'pacs.008.001.10';
  groupHeader: {
    messageId: string;
    creationDateTime: string;
    numberOfTransactions: number;
    settlementInformation: {
      settlementMethod: 'CLRG';
      clearingSystem: 'SOPHIA-RTGS-MESH';
    };
  };
  creditTransferTransactionInformation: {
    paymentIdentification: {
      instructionId: string;
      endToEndId: string;
      uetr: string;
    };
    interbankSettlementAmount: {
      currency: ClearingAsset;
      amount: number;
    };
    interbankSettlementDate: string; // YYYY-MM-DD
    chargeBearer: 'SHAR';
    debtor: {
      name: string;
      identification: string;
    };
    creditor: {
      name: string;
      identification: string;
    };
    remittanceInformation: {
      unstructured: string;
    };
  };
}

export interface Iso20022Camt053StatementItem {
  entryReference: string;
  amount: number;
  currency: ClearingAsset;
  creditDebitIndicator: 'CRDT' | 'DBIT';
  status: 'BOOK';
  bookingDate: string;
  bankTransactionCode: string;
  proprietaryRef: string;
}

export interface Iso20022Camt053Message {
  messageDefinitionIdentifier: 'camt.053.001.10';
  groupHeader: {
    messageId: string;
    creationDateTime: string;
    accountServicer: string;
  };
  statement: {
    statementId: string;
    electronicSequenceNumber: number;
    creationDateTime: string;
    accountIdentification: string;
    balance: {
      type: 'CLBD';
      amount: number;
      currency: ClearingAsset;
      date: string;
    };
    entries: Iso20022Camt053StatementItem[];
  };
}

export interface BilateralTransferLeg {
  fromParticipantId: string;
  toParticipantId: string;
  asset: ClearingAsset;
  amount: number;
}

export interface NettingParticipantSummary {
  participantId: string;
  asset: ClearingAsset;
  grossPayable: number;
  grossReceivable: number;
  netSettlementAmount: number; // positive = receives, negative = pays
}

export interface MultilateralNettingMatrix {
  cycleId: string;
  asset: ClearingAsset;
  totalGrossVolume: number;
  totalNetVolume: number;
  compressionRatioPct: number;
  zeroSumBalanced: boolean;
  participantSummaries: NettingParticipantSummary[];
  settlementBatchIds: string[];
}

/**
 * Audit Ledger & SEC Form S-1 Types
 * Layer: seed
 */

import type { ActorRole, AuditEventType, AuditOpinion, CloseStatus, EventScope, PeriodType, SoxControlId } from './enums';

export interface IpoAuditLedgerRecord {
  id: string;
  sequenceNumber: number;
  periodKey: string;
  orgId: string | null;
  eventType: AuditEventType;
  eventScope: EventScope;
  actorId: string;
  actorRole: ActorRole;
  amountCents: number;
  payloadCanonicalJson: string;
  prevHash: string;
  contentHash: string;
  merkleLeafHash: string;
  digitalSignature: string;
  soxControlId: SoxControlId;
  vasAccountCode: string | null;
  timestamp: number;
  createdAt: number;
}

export interface MerkleProof {
  rootHash: string;
  leafHash: string;
  index: number;
  totalLeaves: number;
  proofHashes: string[];
  proofDirections: ('left' | 'right')[];
  isValid: boolean;
}

export interface LedgerIntegrityResult {
  isValid: boolean;
  totalRecordsChecked: number;
  genesisHashValid: boolean;
  brokenSequenceIndex: number | null;
  tamperedRecordId: string | null;
  computedMerkleRoot: string | null;
  anchoredMerkleRoot: string | null;
  discrepancies: string[];
}

export interface FormS1AuditPack {
  periodKey: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  closeStatus: CloseStatus;
  auditOpinion: AuditOpinion;
  financialMetrics: {
    totalGrossContractValueCents: number;
    recognizedRevenueCents: number;
    deferredRevenueCents: number;
    refundsCents: number;
    netRevenueCents: number;
    activeContractsCount: number;
  };
  intercompanySummary: {
    totalTransfersCount: number;
    grossTransfersCents: number;
    totalWithholdingTaxCents: number;
    netSettledCents: number;
  };
  merkleVerification: {
    rootHash: string;
    digitalSignature: string;
    totalAuditedEvents: number;
    integrityVerified: boolean;
  };
  soxComplianceAttestation: {
    controlsEvaluated: SoxControlId[];
    attestationTimestamp: number;
    signOffStatus: 'CERTIFIED' | 'EXCEPTION_NOTED';
  };
}

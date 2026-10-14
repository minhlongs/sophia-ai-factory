/**
 * Intercompany Transfers Types
 * Layer: seed
 */

import type {
  IntercompanyEntity,
  SettlementStatus,
  TransferType,
  WithholdingTaxRegime,
} from './enums';

export interface IntercompanyTransfer {
  id: string;
  transferReference: string;
  originEntity: IntercompanyEntity;
  destinationEntity: IntercompanyEntity;
  transferType: TransferType;
  currency: string;
  grossAmountCents: number;
  withholdingTaxRegime: WithholdingTaxRegime;
  withholdingTaxRatePct: number;
  withholdingTaxAmountCents: number;
  netSettlementCents: number;
  settlementStatus: SettlementStatus;
  reconciliationLedgerId: string | null;
  approvedBy: string | null;
  transferDate: string;
  settledAt: number | null;
  supportingDocsHash: string | null;
  notes: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface RecordTransferInput {
  originEntity: IntercompanyEntity;
  destinationEntity: IntercompanyEntity;
  transferType: TransferType;
  currency?: string;
  grossAmountCents: number;
  withholdingTaxRegime: WithholdingTaxRegime;
  transferDate: string;
  notes?: string;
  supportingDocsHash?: string;
}

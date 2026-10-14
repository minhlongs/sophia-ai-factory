/**
 * Creator Smart Split Waterfall & Settlement Types
 * Layer: seed
 */

import type {
  ContractorTaxRegime,
  SettlementCurrency,
  SettlementPayoutRail,
  SettlementStatus,
  SplitTier,
} from './constants';

export interface SmartSplitWaterfallResult {
  grossRevenueCents: number;
  splitTier: SplitTier;
  creatorSharePct: number;
  platformSharePct: number;
  daoTreasurySharePct: number;
  creatorGrossCents: number;
  platformCents: number;
  daoTreasuryCents: number;
  // Multi-tier Lineage breakdown (if remix derivative)
  rootCreatorId?: string;
  rootCreatorCents?: number;
  remixerCreatorId?: string;
  remixerCents?: number;
  invarianceVerified: boolean;
}

export interface TaxWithholdingResult {
  grossCents: number;
  taxRegime: ContractorTaxRegime;
  taxRatePct: number;
  taxWithheldCents: number;
  netPayableCents: number;
  invarianceVerified: boolean;
}

export interface CreatorRoyaltySettlement {
  id: string;
  settlementReference: string;
  contractId: string;
  creatorId: string;
  templateId: string | null;
  batchId: string | null;
  grossRoyaltyCents: number;
  creatorGrossShareCents?: number;
  platformShareCents?: number;
  platformFeeCents: number;
  daoTreasuryCents: number;
  contractorTaxRegime: ContractorTaxRegime;
  taxWithholdingRatePct: number;
  taxWithheldCents: number;
  railFeeCents: number;
  netPayableCents: number;
  netPayoutCents?: number;
  payoutRail: SettlementPayoutRail;
  settlementCurrency: SettlementCurrency;
  settlementAmount: number;
  fxRateApplied: number;
  destinationAddress: string;
  destinationBankBin: string | null;
  destinationName: string;
  status: SettlementStatus;
  txHash: string | null;
  qrPayload: string | null;
  idempotencyKey: string;
  failureReason: string | null;
  settledAt: number | null;
  metadataJson: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExecuteRoyaltySplitInput {
  contractId: string;
  grossRevenueCents: number;
  templateId?: string;
  batchId?: string;
  activatingUserId?: string;
  lineageParentCreatorId?: string;
  idempotencyKey: string;
  fxRate?: number;
  payoutRail?: SettlementPayoutRail;
  destinationAddress?: string;
  destinationBankBin?: string;
  destinationName?: string;
  metadata?: Record<string, unknown>;
}

export interface RoyaltySettlementResult {
  success: boolean;
  settlementId: string;
  settlementReference: string;
  waterfall: SmartSplitWaterfallResult;
  taxWithholding: TaxWithholdingResult;
  settlementRecord?: CreatorRoyaltySettlement;
  error?: string;
}

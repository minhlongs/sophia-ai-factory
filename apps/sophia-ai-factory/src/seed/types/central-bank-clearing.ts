/**
 * central-bank-clearing.ts — Gate 12 Milestone Seed Types
 * Pillar 1: Real-Time Central Bank Clearing & ISO 20022 High-Value Payment Engine (CBPR+)
 *
 * Target: $25,000,000 MRR ($300,000,000 ARR, 100,000 Paid Customers, 150% NRR)
 */

export const GATE_12_CONSTANTS = {
  TARGET_MRR_CENTS: 2_500_000_000, // $25,000,000
  TARGET_ARR_CENTS: 30_000_000_000, // $300,000,000
  TARGET_PAID_CUSTOMERS: 100_000,
  TARGET_BLENDED_ARPU_CENTS: 25_000, // $250.00
  MIN_NRR_PERCENTAGE: 150, // 150%
  RULE_OF_FORTY_TARGET: 75, // 75%
  SEVEN_NINES_UPTIME_PERCENTAGE: 99.99999, // 99.99999%
  MAX_ALLOWED_DOWNTIME_MS_MONTH: 259, // 259.2 ms per 30-day month
  MAX_SLIPPAGE_BPS: 1, // 1 bps = 0.01%
} as const;

export type CentralBankJurisdiction = 'US' | 'EU' | 'SG' | 'VN' | 'JP' | 'UK' | 'CH';
export type CentralBankRtgsNetwork = 'FEDWIRE' | 'CHIPS' | 'TARGET2' | 'FAST_SG' | 'CITAD_VN' | 'BOJ_NET' | 'CHAPS';
export type ClearingNodeStatus = 'ACTIVE' | 'RESTRICTED' | 'SUSPENDED' | 'OFFLINE';

export interface CentralBankClearingNode {
  id: string;
  bicCode: string;
  institutionName: string;
  jurisdiction: CentralBankJurisdiction;
  rtgsNetwork: CentralBankRtgsNetwork;
  clearingStatus: ClearingNodeStatus;
  settlementCurrency: string;
  creditLineCents: number;
  currentBalanceCents: number;
  lastSettlementAt: string;
  createdAt: string;
}

export type Iso20022MessageType = 'pacs.009.001.10' | 'pacs.004.001.11' | 'camt.054.001.10';
export type Iso20022ChargeBearer = 'DEBT' | 'CRED' | 'SHAR' | 'SLEV';
export type Iso20022VerificationStatus = 'PARSED_VALID' | 'SCHEMA_ERROR' | 'SIGNATURE_INVALID' | 'SETTLED' | 'RETURNED';

export interface Iso20022PacsMessage {
  id: string;
  messageDefinitionId: Iso20022MessageType;
  endToEndId: string;
  uetr: string;
  instructingAgentBic: string;
  instructedAgentBic: string;
  settlementCurrency: string;
  interbankSettlementAmountCents: number;
  settlementDate: string;
  chargeBearer: Iso20022ChargeBearer;
  rawXmlPayload: string;
  signatureDigestHex: string;
  verificationStatus: Iso20022VerificationStatus;
  createdAt: string;
}

export type RtgsBatchStatus = 'OPEN' | 'NETTING_CALCULATED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';

export interface RtgsSettlementBatch {
  id: string;
  batchReference: string;
  cycleNumber: number;
  totalGrossVolumeCents: number;
  totalNetVolumeCents: number;
  compressionRatioPercentage: number;
  settledTransactionsCount: number;
  batchStatus: RtgsBatchStatus;
  merkleRootHex: string;
  executedAt: string | null;
  createdAt: string;
}

export interface FxCorridor {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  exchangeRateMicros: number; // 1.000000 = 1_000_000
  intradayVolumeCents: number;
  spreadBps: number;
  isActive: boolean;
  updatedAt: string;
}

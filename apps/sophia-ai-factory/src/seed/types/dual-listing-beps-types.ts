/**
 * BEPS Pillar Two and FCPA Compliance Types
 *
 * @module seed/types/dual-listing-beps-types
 */

export type BepsJurisdictionCode = 'US' | 'SG' | 'VN' | 'IE' | 'KY';
export type FcpaScreeningType = 'PEP_CHECK' | 'SANCTIONS_OFAC' | 'BRIBERY_RISK' | 'TRANSACTION_AUDIT';
export type FcpaDisposition = 'CLEARED' | 'FLAGGED' | 'ESCALATED_LEGAL' | 'BLOCKED';

export interface BepsTaxAllocation {
  id: string;
  filingPeriodId: string;
  jurisdictionCode: BepsJurisdictionCode;
  coveredTaxesCents: number;
  globeIncomeCents: number;
  effectiveTaxRateBps: number;
  minimumRateBps: number;
  topUpTaxPercentageBps: number;
  topUpTaxCents: number;
  substanceCarveOutCents: number;
  netTopUpTaxCents: number;
  safeguardMerkleRoot: string;
  createdAt: string;
}

export interface FcpaComplianceScreening {
  id: string;
  filingPeriodId: string;
  counterpartyName: string;
  counterpartyJurisdiction: string;
  screeningType: FcpaScreeningType;
  riskScore: number;
  disposition: FcpaDisposition;
  reviewedBy: string;
  reviewNotes: string | null;
  immutableHash: string;
  createdAt: string;
}

export interface BepsComputationInput {
  jurisdictionCode: BepsJurisdictionCode;
  coveredTaxesCents: number;
  globeIncomeCents: number;
  substanceCarveOutCents?: number;
}

export interface BepsComputationResult {
  jurisdictionCode: BepsJurisdictionCode;
  coveredTaxesCents: number;
  globeIncomeCents: number;
  effectiveTaxRateBps: number;
  minimumRateBps: number;
  topUpTaxPercentageBps: number;
  topUpTaxCents: number;
  substanceCarveOutCents: number;
  netTopUpTaxCents: number;
  isCompliant: boolean;
}

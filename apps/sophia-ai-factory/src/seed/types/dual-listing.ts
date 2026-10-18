/**
 * dual-listing.ts — Gate 11 Milestone Seed Types
 * Pillar 1: NASDAQ & SGX Dual-Listing Compliance Engine, Inline XBRL (iXBRL) & BEPS Pillar Two Tax Vault
 *
 * Target: $10,000,000 MRR ($120,000,000 ARR, 40,000 Paid Customers, 145% NRR)
 */

export {
  rowToDualListingPeriod,
  rowToBepsTaxAllocation,
} from './dual-listing-mappers';

export {
  type BepsJurisdictionCode,
  type FcpaScreeningType,
  type FcpaDisposition,
  type BepsTaxAllocation,
  type FcpaComplianceScreening,
  type BepsComputationInput,
  type BepsComputationResult,
} from './dual-listing-beps-types';

import type {
  BepsTaxAllocation,
  FcpaComplianceScreening,
} from './dual-listing-beps-types';

export const GATE_11_CONSTANTS = {
  TARGET_MRR_CENTS: 1_000_000_000, // $10,000,000
  TARGET_ARR_CENTS: 12_000_000_000, // $120,000,000
  TARGET_PAID_CUSTOMERS: 40_000,
  TARGET_BLENDED_ARPU_CENTS: 25_000, // $250.00
  MIN_NRR_PERCENTAGE: 145, // 145%
  RULE_OF_FORTY_TARGET: 70, // 70%
  BEPS_MIN_TAX_RATE_BPS: 1500, // 15.00% (1500 basis points)
  US_CIK_DEFAULT: '0001984210',
  SGX_TICKER_DEFAULT: 'SPH.SI',
} as const;

export type DualListingFilingType = 'SEC_10K' | 'SEC_10Q' | 'SGX_ANNUAL' | 'SGX_SEMIANNUAL';
export type DualListingAuditOpinion = 'UNQUALIFIED' | 'QUALIFIED' | 'ADVERSE' | 'DISCLAIMER';
export type DualListingStatus = 'DRAFT' | 'AUDIT_IN_PROGRESS' | 'BOARD_APPROVED' | 'FILED' | 'AMENDED';
export type IxbrlStandard = 'US_GAAP_2026' | 'IFRS_2026' | 'SFRS_I_2026';

export interface DualListingPeriod {
  id: string;
  periodName: string;
  fiscalYear: number;
  fiscalQuarter: number | null;
  filingType: DualListingFilingType;
  usCik: string;
  sgxTicker: string;
  currency: string;
  consolidatedRevenueCents: number;
  consolidatedEbitdaCents: number;
  adjustedEbitdaCents: number;
  freeCashFlowCents: number;
  netIncomeCents: number;
  paidCustomersCount: number;
  arpuCents: number;
  nrrPercentage: number;
  ruleOfFortyPercentage: number;
  auditFirmName: string;
  auditOpinionType: DualListingAuditOpinion;
  ixbrlDocumentUri: string | null;
  secEdgarSubmissionId: string | null;
  sgxNetAnnouncementId: string | null;
  status: DualListingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface IxbrlTaxonomy {
  id: string;
  filingPeriodId: string;
  standard: IxbrlStandard;
  tagName: string;
  contextRef: string;
  unitRef: string;
  decimals: string;
  valueRaw: string;
  valueNumeric: number | null;
  isNegated: boolean;
  lineItemDescription: string | null;
  createdAt: string;
}

export interface DualListingConsolidatedPackage {
  filingPeriod: DualListingPeriod;
  ixbrlEntries: IxbrlTaxonomy[];
  bepsAllocations: BepsTaxAllocation[];
  fcpaScreenings: FcpaComplianceScreening[];
  overallCompliant: boolean;
  packageHash: string;
}

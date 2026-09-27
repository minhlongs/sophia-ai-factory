/**
 * dual-listing.ts — Gate 11 Milestone Seed Types
 * Pillar 1: NASDAQ & SGX Dual-Listing Compliance Engine, Inline XBRL (iXBRL) & BEPS Pillar Two Tax Vault
 *
 * Target: $10,000,000 MRR ($120,000,000 ARR, 40,000 Paid Customers, 145% NRR)
 */

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
export type BepsJurisdictionCode = 'US' | 'SG' | 'VN' | 'IE' | 'KY';
export type FcpaScreeningType = 'PEP_CHECK' | 'SANCTIONS_OFAC' | 'BRIBERY_RISK' | 'TRANSACTION_AUDIT';
export type FcpaDisposition = 'CLEARED' | 'FLAGGED' | 'ESCALATED_LEGAL' | 'BLOCKED';

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

export interface DualListingConsolidatedPackage {
  filingPeriod: DualListingPeriod;
  ixbrlEntries: IxbrlTaxonomy[];
  bepsAllocations: BepsTaxAllocation[];
  fcpaScreenings: FcpaComplianceScreening[];
  overallCompliant: boolean;
  packageHash: string;
}

export function rowToDualListingPeriod(row: Record<string, unknown>): DualListingPeriod {
  return {
    id: String(row.id),
    periodName: String(row.period_name),
    fiscalYear: Number(row.fiscal_year),
    fiscalQuarter: row.fiscal_quarter !== null && row.fiscal_quarter !== undefined ? Number(row.fiscal_quarter) : null,
    filingType: String(row.filing_type) as DualListingFilingType,
    usCik: String(row.us_cik),
    sgxTicker: String(row.sgx_ticker),
    currency: String(row.currency),
    consolidatedRevenueCents: Number(row.consolidated_revenue_cents),
    consolidatedEbitdaCents: Number(row.consolidated_ebitda_cents),
    adjustedEbitdaCents: Number(row.adjusted_ebitda_cents),
    freeCashFlowCents: Number(row.free_cash_flow_cents),
    netIncomeCents: Number(row.net_income_cents),
    paidCustomersCount: Number(row.paid_customers_count),
    arpuCents: Number(row.arpu_cents),
    nrrPercentage: Number(row.nrr_percentage),
    ruleOfFortyPercentage: Number(row.rule_of_forty_percentage),
    auditFirmName: String(row.audit_firm_name),
    auditOpinionType: String(row.audit_opinion_type) as DualListingAuditOpinion,
    ixbrlDocumentUri: row.ixbrl_document_uri ? String(row.ixbrl_document_uri) : null,
    secEdgarSubmissionId: row.sec_edgar_submission_id ? String(row.sec_edgar_submission_id) : null,
    sgxNetAnnouncementId: row.sgx_net_announcement_id ? String(row.sgx_net_announcement_id) : null,
    status: String(row.status) as DualListingStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function rowToBepsTaxAllocation(row: Record<string, unknown>): BepsTaxAllocation {
  return {
    id: String(row.id),
    filingPeriodId: String(row.filing_period_id),
    jurisdictionCode: String(row.jurisdiction_code) as BepsJurisdictionCode,
    coveredTaxesCents: Number(row.covered_taxes_cents),
    globeIncomeCents: Number(row.globe_income_cents),
    effectiveTaxRateBps: Number(row.effective_tax_rate_bps),
    minimumRateBps: Number(row.minimum_rate_bps),
    topUpTaxPercentageBps: Number(row.top_up_tax_percentage_bps),
    topUpTaxCents: Number(row.top_up_tax_cents),
    substanceCarveOutCents: Number(row.substance_carve_out_cents),
    netTopUpTaxCents: Number(row.net_top_up_tax_cents),
    safeguardMerkleRoot: String(row.safeguard_merkle_root),
    createdAt: String(row.created_at),
  };
}

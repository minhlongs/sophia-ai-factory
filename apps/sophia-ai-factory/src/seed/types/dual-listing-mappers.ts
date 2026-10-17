/**
 * Row mappers for Dual-Listing Compliance Engine and BEPS Pillar Two Tax Vault.
 *
 * @module seed/types/dual-listing-mappers
 */

import type {
  BepsJurisdictionCode,
  BepsTaxAllocation,
  DualListingAuditOpinion,
  DualListingFilingType,
  DualListingPeriod,
  DualListingStatus,
} from './dual-listing';

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

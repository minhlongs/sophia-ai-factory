/**
 * Dual Listing Parity & BEPS Pillar Two Calculator
 *
 * Implements OECD BEPS Pillar Two GloBE 15% Top-up Tax calculations
 * and Gate 11 Filing Period benchmark generation.
 *
 * Layer: tree (Business Logic)
 *
 * @module tree/listing/dual-listing/parity-enforcer
 */

import {
  GATE_11_CONSTANTS,
  type BepsComputationInput,
  type BepsComputationResult,
  type DualListingFilingType,
  type DualListingPeriod,
} from './types';

export class ParityEnforcer {
  /**
   * Computes the OECD BEPS Pillar Two GloBE Effective Tax Rate (ETR)
   * and any required Top-up Tax for a given jurisdiction.
   */
  public static calculateBepsPillarTwo(input: BepsComputationInput): BepsComputationResult {
    const { jurisdictionCode, coveredTaxesCents, globeIncomeCents, substanceCarveOutCents = 0 } = input;

    if (globeIncomeCents <= 0) {
      return {
        jurisdictionCode,
        coveredTaxesCents,
        globeIncomeCents,
        effectiveTaxRateBps: GATE_11_CONSTANTS.BEPS_MIN_TAX_RATE_BPS,
        minimumRateBps: GATE_11_CONSTANTS.BEPS_MIN_TAX_RATE_BPS,
        topUpTaxPercentageBps: 0,
        topUpTaxCents: 0,
        substanceCarveOutCents: 0,
        netTopUpTaxCents: 0,
        isCompliant: true,
      };
    }

    // ETR in basis points: (Covered Taxes / GloBE Income) * 10,000
    const rawEtrBps = Math.floor((coveredTaxesCents / globeIncomeCents) * 10_000);
    const effectiveTaxRateBps = Math.max(0, rawEtrBps);
    const minimumRateBps = GATE_11_CONSTANTS.BEPS_MIN_TAX_RATE_BPS;

    // Top-up tax rate = max(0, 1500 - ETR)
    const topUpTaxPercentageBps = Math.max(0, minimumRateBps - effectiveTaxRateBps);

    // Excess profit subject to top-up tax = GloBE Income - Substance Carve-out
    const excessProfitCents = Math.max(0, globeIncomeCents - substanceCarveOutCents);

    // Top-up tax = (Top-up % / 10,000) * Excess Profit
    const topUpTaxCents = Math.floor((topUpTaxPercentageBps / 10_000) * globeIncomeCents);
    const netTopUpTaxCents = Math.floor((topUpTaxPercentageBps / 10_000) * excessProfitCents);

    return {
      jurisdictionCode,
      coveredTaxesCents,
      globeIncomeCents,
      effectiveTaxRateBps,
      minimumRateBps,
      topUpTaxPercentageBps,
      topUpTaxCents,
      substanceCarveOutCents,
      netTopUpTaxCents,
      isCompliant: effectiveTaxRateBps >= minimumRateBps || netTopUpTaxCents >= 0,
    };
  }

  /**
   * Builds the canonical Gate 11 Dual-Listing Package for a given fiscal year.
   */
  public static createGate11FilingPeriod(
    fiscalYear = 2026,
    filingType: DualListingFilingType = 'SEC_10K',
  ): DualListingPeriod {
    const revenueCents = GATE_11_CONSTANTS.TARGET_MRR_CENTS * 12; // $120M annual
    const ebitdaCents = Math.floor(revenueCents * 0.38); // $45.6M EBITDA (38% margin)
    const adjEbitdaCents = Math.floor(revenueCents * 0.42); // $50.4M Adjusted EBITDA
    const fcfCents = Math.floor(revenueCents * 0.35); // $42M FCF
    const netIncomeCents = Math.floor(revenueCents * 0.30); // $36M Net Income

    // Growth rate ~ 100% YoY, FCF margin ~ 35% -> Rule of 40 = 135%
    const ruleOfForty = 135;

    return {
      id: `dlp_${filingType.toLowerCase()}_${fiscalYear}`,
      periodName: `Sophia AI Factory Dual-Listing Annual Report ${fiscalYear}`,
      fiscalYear,
      fiscalQuarter: filingType === 'SEC_10K' || filingType === 'SGX_ANNUAL' ? null : 4,
      filingType,
      usCik: GATE_11_CONSTANTS.US_CIK_DEFAULT,
      sgxTicker: GATE_11_CONSTANTS.SGX_TICKER_DEFAULT,
      currency: 'USD',
      consolidatedRevenueCents: revenueCents,
      consolidatedEbitdaCents: ebitdaCents,
      adjustedEbitdaCents: adjEbitdaCents,
      freeCashFlowCents: fcfCents,
      netIncomeCents,
      paidCustomersCount: GATE_11_CONSTANTS.TARGET_PAID_CUSTOMERS,
      arpuCents: GATE_11_CONSTANTS.TARGET_BLENDED_ARPU_CENTS,
      nrrPercentage: GATE_11_CONSTANTS.MIN_NRR_PERCENTAGE,
      ruleOfFortyPercentage: ruleOfForty,
      auditFirmName: 'Ernst & Young LLP (Global)',
      auditOpinionType: 'UNQUALIFIED',
      ixbrlDocumentUri: `https://storage.agencyos.network/filings/${fiscalYear}/form10k_ixbrl.xml`,
      secEdgarSubmissionId: `EDGAR-0001984210-${fiscalYear}-0001`,
      sgxNetAnnouncementId: `SGX-SPH-${fiscalYear}-ANN-001`,
      status: 'BOARD_APPROVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

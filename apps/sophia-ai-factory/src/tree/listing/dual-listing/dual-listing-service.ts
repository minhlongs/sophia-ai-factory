/**
 * Dual Listing Service Orchestrator
 *
 * Coordinates iXBRL tagging, package assembly with Merkle/SHA-256 integrity,
 * and delegates to ParityEnforcer and ListingSync.
 *
 * Layer: tree (Business Logic)
 *
 * @module tree/listing/dual-listing/dual-listing-service
 */

import { createHash } from 'node:crypto';
import type { D1Database } from '@cloudflare/workers-types';
import {
  GATE_11_CONSTANTS,
  type DualListingPeriod,
  type DualListingFilingType,
  type IxbrlTaxonomy,
  type BepsTaxAllocation,
  type BepsComputationInput,
  type BepsComputationResult,
  type DualListingConsolidatedPackage,
} from './types';
import { ParityEnforcer } from './parity-enforcer';
import { ListingSync } from './listing-sync';
import { buildIxbrlTagsForPeriod } from './ixbrl-tag-generator';

export class DualListingEngine {
  /**
   * Computes OECD BEPS Pillar Two GloBE Effective Tax Rate (ETR)
   */
  public static calculateBepsPillarTwo(input: BepsComputationInput): BepsComputationResult {
    return ParityEnforcer.calculateBepsPillarTwo(input);
  }

  /**
   * Builds canonical Gate 11 Dual-Listing Package for a given fiscal year.
   */
  public static createGate11FilingPeriod(
    fiscalYear = 2026,
    filingType: DualListingFilingType = 'SEC_10K',
  ): DualListingPeriod {
    return ParityEnforcer.createGate11FilingPeriod(fiscalYear, filingType);
  }

  /**
   * Generates standard Inline XBRL (iXBRL) taxonomy entries for a filing period.
   */
  public static generateIxbrlTags(filingPeriod: DualListingPeriod): IxbrlTaxonomy[] {
    return buildIxbrlTagsForPeriod(filingPeriod);
  }

  /**
   * Consolidates complete Dual-Listing Filing Package with cryptographic integrity hash.
   */
  public static assembleConsolidatedPackage(
    filingPeriod: DualListingPeriod,
    bepsInputs: BepsComputationInput[],
  ): DualListingConsolidatedPackage {
    const ixbrlEntries = this.generateIxbrlTags(filingPeriod);

    const bepsAllocations: BepsTaxAllocation[] = bepsInputs.map((input, idx) => {
      const res = this.calculateBepsPillarTwo(input);
      const rootHash = createHash('sha256')
        .update(`${res.jurisdictionCode}:${res.coveredTaxesCents}:${res.netTopUpTaxCents}`)
        .digest('hex');

      return {
        id: `beps_${filingPeriod.id}_${idx + 1}`,
        filingPeriodId: filingPeriod.id,
        jurisdictionCode: res.jurisdictionCode,
        coveredTaxesCents: res.coveredTaxesCents,
        globeIncomeCents: res.globeIncomeCents,
        effectiveTaxRateBps: res.effectiveTaxRateBps,
        minimumRateBps: res.minimumRateBps,
        topUpTaxPercentageBps: res.topUpTaxPercentageBps,
        topUpTaxCents: res.topUpTaxCents,
        substanceCarveOutCents: res.substanceCarveOutCents,
        netTopUpTaxCents: res.netTopUpTaxCents,
        safeguardMerkleRoot: rootHash,
        createdAt: new Date().toISOString(),
      };
    });

    const payloadToHash = JSON.stringify({
      periodId: filingPeriod.id,
      revenue: filingPeriod.consolidatedRevenueCents,
      ixbrlCount: ixbrlEntries.length,
      bepsCount: bepsAllocations.length,
    });

    const packageHash = createHash('sha256').update(payloadToHash).digest('hex');

    return {
      filingPeriod,
      ixbrlEntries,
      bepsAllocations,
      fcpaScreenings: [],
      overallCompliant: filingPeriod.ruleOfFortyPercentage >= GATE_11_CONSTANTS.RULE_OF_FORTY_TARGET,
      packageHash,
    };
  }

  /**
   * Persists a Dual-Listing Period into Cloudflare D1.
   */
  public static async persistFilingPeriod(db: D1Database, period: DualListingPeriod): Promise<void> {
    return ListingSync.persistFilingPeriod(db, period);
  }

  /**
   * Loads a filing period by ID from Cloudflare D1.
   */
  public static async getFilingPeriod(db: D1Database, id: string): Promise<DualListingPeriod | null> {
    return ListingSync.getFilingPeriod(db, id);
  }
}

/**
 * Helpers and canonical BEPS inputs for Gate 11 Dual-Listing Server Actions.
 * @module land/listing/dual-listing-action-helpers
 */

import { getD1 } from '@/seed/db/client';
import {
  type DualListingFilingType,
  type BepsComputationInput,
  type DualListingConsolidatedPackage,
} from '@/seed/types/dual-listing';
import { DualListingEngine } from '@/tree/listing/dual-listing-engine';

export const DEFAULT_GATE11_BEPS_INPUTS: BepsComputationInput[] = [
  { jurisdictionCode: 'US', coveredTaxesCents: 15_000_000_00, globeIncomeCents: 75_000_000_00 }, // 20% ETR
  { jurisdictionCode: 'SG', coveredTaxesCents: 2_500_000_00, globeIncomeCents: 25_000_000_00 }, // 10% ETR -> triggers 5% top-up
  { jurisdictionCode: 'VN', coveredTaxesCents: 3_000_000_00, globeIncomeCents: 15_000_000_00 }, // 20% ETR
  { jurisdictionCode: 'IE', coveredTaxesCents: 625_000_00, globeIncomeCents: 5_000_000_00 }, // 12.5% ETR -> triggers 2.5% top-up
];

export async function assembleAndPersistDualListingPackage(
  fiscalYear: number,
  filingType: DualListingFilingType
): Promise<DualListingConsolidatedPackage> {
  const db = await getD1();
  const period = DualListingEngine.createGate11FilingPeriod(fiscalYear, filingType);
  const pkg = DualListingEngine.assembleConsolidatedPackage(period, DEFAULT_GATE11_BEPS_INPUTS);

  if (db) {
    await DualListingEngine.persistFilingPeriod(db, period);
  }

  return pkg;
}

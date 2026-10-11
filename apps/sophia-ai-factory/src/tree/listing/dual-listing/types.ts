/**
 * Dual Listing & BEPS Pillar Two Types & Constants
 *
 * Layer: tree (Business Logic)
 *
 * @module tree/listing/dual-listing/types
 */

export {
  GATE_11_CONSTANTS,
  type DualListingPeriod,
  type DualListingFilingType,
  type IxbrlTaxonomy,
  type BepsTaxAllocation,
  type BepsComputationInput,
  type BepsComputationResult,
  type DualListingConsolidatedPackage,
  rowToDualListingPeriod,
} from '@/seed/types/dual-listing';

export interface IxbrlTagItem {
  tag: string;
  valRaw: string;
  valNum: number;
  desc: string;
}

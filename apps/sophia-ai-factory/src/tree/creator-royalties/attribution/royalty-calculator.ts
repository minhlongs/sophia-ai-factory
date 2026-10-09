/**
 * @file royalty-calculator.ts
 * @description Pure mathematical calculation for creator royalties and multi-tier lineage splits.
 * @layer tree
 */

import type { MultiTierRoyaltySplit } from '@/seed/types/creator-marketplace';

/**
 * Pure royalty calculation with integer truncation.
 * Formula: floor((revenueCents * royaltyPercent) / 100)
 *
 * Guarantees:
 * - 0% royalty yields 0 cents
 * - 100% royalty yields exact revenueCents
 * - Zero revenue yields 0 cents
 * - Math.floor prevents fractional cent drift and platform leakage
 */
export function calculateRoyaltyCents(revenueCents: number, royaltyPercent: number): number {
  if (revenueCents <= 0 || royaltyPercent <= 0) return 0;
  if (royaltyPercent >= 100) return revenueCents;
  return Math.floor((revenueCents * royaltyPercent) / 100);
}

/**
 * Multi-tier lineage split (70% root creator / 30% direct parent remixer).
 *
 * Invariants:
 * - rootRoyaltyCents + parentRoyaltyCents === totalRoyaltyPool
 * - Any fractional penny remainder goes to root creator (zero leakage)
 * - Self-parenting collapses to 100% root share
 */
export function calculateMultiTierSplit(
  revenueCents: number,
  royaltyPercent: number,
  rootCreatorId: string,
  parentCreatorId?: string,
): MultiTierRoyaltySplit {
  const totalPool = calculateRoyaltyCents(revenueCents, royaltyPercent);

  // Single-tier or collapsed parent
  if (!parentCreatorId || parentCreatorId === rootCreatorId) {
    return {
      totalRoyaltyCents: totalPool,
      rootCreatorId,
      rootRoyaltyCents: totalPool,
    };
  }

  // Two-tier derivative: 70% root creator, 30% direct parent remixer
  const parentRoyalty = Math.floor(totalPool * 0.3);
  const rootRoyalty = totalPool - parentRoyalty; // Remainder cent allocated to root creator

  return {
    totalRoyaltyCents: totalPool,
    rootCreatorId,
    rootRoyaltyCents: rootRoyalty,
    parentCreatorId,
    parentRoyaltyCents: parentRoyalty,
  };
}

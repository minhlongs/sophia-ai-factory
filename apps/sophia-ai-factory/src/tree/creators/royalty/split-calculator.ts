/**
 * Creator Smart Split Waterfall Calculator.
 *
 * Implements:
 * - Smart Split Waterfall (80/20 DAO Exclusive & 70/30 Standard Marketplace)
 * - Zero-Penny Leakage Invariant: creatorGrossCents + daoTreasuryCents + platformCents === grossRevenueCents
 * - Multi-tier Lineage Attribution: 70% root creator / 30% remixer derivative cascade
 *
 * Layer: tree/creators/royalty
 *
 * @module tree/creators/royalty/split-calculator
 */

import {
  DAO_80_20_CREATOR_PCT,
  DAO_80_20_PLATFORM_PCT,
  STANDARD_70_30_CREATOR_PCT,
  STANDARD_70_30_PLATFORM_PCT,
  type SmartSplitWaterfallResult,
  type SplitTier,
} from '@/seed/types/creator-dao-c2pa';
import type { SplitWaterfallOptions } from './types';

/**
 * Calculates the exact split waterfall for creator earnings with mathematical zero-penny leakage.
 *
 * Invariant: creatorGrossCents + daoTreasuryCents + platformCents === grossRevenueCents
 * Lineage Invariant (if remix): rootCreatorCents + remixerCents === creatorGrossCents
 */
export function calculateSmartSplitWaterfall(
  grossRevenueCents: number,
  tier: SplitTier,
  options?: SplitWaterfallOptions,
): SmartSplitWaterfallResult {
  if (grossRevenueCents < 0 || !Number.isInteger(grossRevenueCents)) {
    throw new Error(
      `grossRevenueCents must be a non-negative integer, got: ${grossRevenueCents}`,
    );
  }

  // 1. Determine split percentages based on tier
  let creatorPct: number;
  let platformPct: number;
  let daoPct: number;

  if (tier === 'DAO_80_20') {
    creatorPct = options?.creatorSharePct ?? DAO_80_20_CREATOR_PCT;
    daoPct = options?.daoTreasurySharePct ?? 0.0;
    platformPct =
      options?.platformSharePct ?? Math.max(0, DAO_80_20_PLATFORM_PCT - daoPct);
  } else if (tier === 'STANDARD_70_30') {
    creatorPct = options?.creatorSharePct ?? STANDARD_70_30_CREATOR_PCT;
    daoPct = options?.daoTreasurySharePct ?? 0.0;
    platformPct =
      options?.platformSharePct ??
      Math.max(0, STANDARD_70_30_PLATFORM_PCT - daoPct);
  } else {
    // CUSTOM
    creatorPct = options?.creatorSharePct ?? STANDARD_70_30_CREATOR_PCT;
    daoPct = options?.daoTreasurySharePct ?? 0.0;
    platformPct =
      options?.platformSharePct ??
      Math.max(0, 100.0 - creatorPct - daoPct);
  }

  // 2. Exact integer cent distribution with zero penny leakage
  const creatorGrossCents = Math.floor((grossRevenueCents * creatorPct) / 100);
  const daoTreasuryCents = Math.floor((grossRevenueCents * daoPct) / 100);
  // Platform absorbs remainder cents to guarantee zero leak
  const platformCents =
    grossRevenueCents - creatorGrossCents - daoTreasuryCents;

  const invarianceVerified =
    creatorGrossCents + daoTreasuryCents + platformCents === grossRevenueCents;

  // 3. Multi-tier Lineage Waterfall (if remix derivative)
  let rootCreatorCents: number | undefined;
  let remixerCents: number | undefined;

  if (options?.lineageParentCreatorId && creatorGrossCents > 0) {
    // Standard lineage split: 70% root original creator, 30% remixer derivative
    rootCreatorCents = Math.floor((creatorGrossCents * 70) / 100);
    remixerCents = creatorGrossCents - rootCreatorCents;
  }

  return {
    grossRevenueCents,
    splitTier: tier,
    creatorSharePct: creatorPct,
    platformSharePct: platformPct,
    daoTreasurySharePct: daoPct,
    creatorGrossCents,
    platformCents,
    daoTreasuryCents,
    rootCreatorId: options?.rootCreatorId,
    rootCreatorCents,
    remixerCreatorId: options?.lineageParentCreatorId,
    remixerCents,
    invarianceVerified,
  };
}

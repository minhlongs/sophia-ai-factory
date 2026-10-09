/**
 * @file split-calculator.ts
 * @description Pure integer 70/30 royalty split calculations and anti-circular activation guards.
 * @layer tree
 */

import type { RoyaltySplit } from '../types';
import { DEFAULT_ROYALTY_PCT } from './constants';

/**
 * Calculates pure integer 70/30 royalty split with zero fractional penny leakage.
 */
export function calculateRoyaltySplit(
  priceCents: number,
  royaltyPct = DEFAULT_ROYALTY_PCT,
): RoyaltySplit {
  if (priceCents <= 0) {
    return { creatorCents: 0, platformCents: 0, totalCents: 0 };
  }

  if (royaltyPct <= 0) {
    return { creatorCents: 0, platformCents: priceCents, totalCents: priceCents };
  }

  if (royaltyPct >= 100) {
    return { creatorCents: priceCents, platformCents: 0, totalCents: priceCents };
  }

  const creatorCents = Math.floor((priceCents * royaltyPct) / 100);
  const platformCents = priceCents - creatorCents;

  return {
    creatorCents,
    platformCents,
    totalCents: priceCents,
  };
}

/**
 * Checks for circular self-activation.
 */
export function isSelfTemplateActivation(creatorId: string, activatingUserId: string): boolean {
  if (!creatorId || !activatingUserId) return false;
  return creatorId.trim() === activatingUserId.trim();
}

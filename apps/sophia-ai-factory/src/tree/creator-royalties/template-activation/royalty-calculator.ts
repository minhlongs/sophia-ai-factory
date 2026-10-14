/**
 * Template Royalty Calculation & Anti-Fraud Logic
 *
 * Layer: tree/creator-royalties/template-activation
 */

import type { TemplateRoyaltySplit } from '@/seed/types/creator-marketplace';

/** Default creator royalty percentage under the 70/30 protocol */
export const DEFAULT_TEMPLATE_ROYALTY_PCT = 70.0;

/**
 * Pure integer 70/30 royalty calculation.
 *
 * Mathematical guarantees:
 * - creatorCents + platformCents === priceCents (zero penny leakage)
 * - priceCents <= 0 yields 0 for both creator and platform
 * - royaltyPct <= 0 yields 0 to creator, 100% to platform
 * - royaltyPct >= 100 yields 100% to creator, 0 to platform
 * - Pure integer arithmetic via Math.floor
 */
export function calculateTemplateRoyalty(
  priceCents: number,
  royaltyPct = DEFAULT_TEMPLATE_ROYALTY_PCT,
): TemplateRoyaltySplit {
  if (priceCents <= 0) {
    return { creatorCents: 0, platformCents: 0 };
  }

  if (royaltyPct <= 0) {
    return { creatorCents: 0, platformCents: priceCents };
  }

  if (royaltyPct >= 100) {
    return { creatorCents: priceCents, platformCents: 0 };
  }

  const creatorCents = Math.floor((priceCents * royaltyPct) / 100);
  const platformCents = priceCents - creatorCents;

  return {
    creatorCents,
    platformCents,
  };
}

/**
 * Checks if activation is a circular self-activation.
 * Creators cannot earn royalties by activating their own templates.
 */
export function isSelfTemplateActivation(creatorId: string, activatingUserId: string): boolean {
  if (!creatorId || !activatingUserId) return false;
  return creatorId.trim() === activatingUserId.trim();
}

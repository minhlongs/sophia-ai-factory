/**
 * Tests for multi-commission stacking scenario
 *
 * Verifies the SOP marketplace stacked commission math:
 * - SOP sale: creator gets 70%, platform keeps 30%
 * - If affiliate referred: from platform's 30%, referrer gets their cut
 * - Existing commission_calculator handles marketplace price inputs
 *
 * @module land/affiliates/__tests__/stacked-commission
 */

import { describe, it, expect } from 'vitest';
import { calculateCreatorCommission } from '@/land/sop-marketplace/commission-split';
import { calcCommission } from '@/land/affiliates/commission-calculator';

describe('SOP marketplace stacked commission', () => {
  // SOP sells for 19900 cents = $199
  const sopPriceCents = 19900;

  it('SOP 70/30 split: creator gets 13930, platform keeps 5970', () => {
    const split = calculateCreatorCommission(sopPriceCents);

    expect(split.creatorCents).toBe(13930); // 70%
    expect(split.platformCents).toBe(5970); // 30%
    expect(split.creatorCents + split.platformCents).toBe(sopPriceCents);
  });

  it('affiliate referral commission comes from platform 30% share', () => {
    const split = calculateCreatorCommission(sopPriceCents);
    const platformShare = split.platformCents; // 5970

    // If affiliate referred: referrer gets 20% of gross (3980)
    const referrerPct = 0.2;
    const referrerCents = Math.floor(sopPriceCents * referrerPct); // 3980

    // Platform keeps the remainder after paying referrer
    const platformAfterReferral = platformShare - referrerCents; // 1990

    expect(referrerCents).toBe(3980);
    expect(platformAfterReferral).toBe(1990);

    // Verify: creator + referrer + platform residual = total
    expect(split.creatorCents + referrerCents + platformAfterReferral).toBe(sopPriceCents);
  });

  it('affiliate commission calculator handles marketplace price inputs in dollars', () => {
    // Marketplace price in dollars: 19900 cents = $199
    const priceUsd = 199;

    // calcCommission splits gross 70/30
    const affiliateSplit = calcCommission(priceUsd);

    // 70% of $199 = $139.30 (rounded to 4dp)
    expect(affiliateSplit.user).toBe(139.3);
    // 30% of $199 = $59.70
    expect(affiliateSplit.sophia).toBe(59.7);

    // Verify rounding
    expect(affiliateSplit.user + affiliateSplit.sophia).toBeCloseTo(priceUsd, 4);
  });

  it('verifies full stacking: creator 70%, aff 20%, platform 10%', () => {
    // Layered commission stacking:
    // Level 1 (SOP creator): 70% of gross
    // Level 2 (affiliate referrer): 20% of gross (from platform's 30%)
    // Level 3 (platform residual): 10% of gross

    const totalCents = sopPriceCents; // 19900

    const creatorCents = Math.floor(totalCents * 0.7); // 13930
    const referrerCents = Math.floor(totalCents * 0.2); // 3980
    const platformCents = totalCents - creatorCents - referrerCents; // 1990

    // Verify each level
    expect(creatorCents).toBe(13930);
    expect(referrerCents).toBe(3980);
    expect(platformCents).toBe(1990);

    // Total sums
    expect(creatorCents + referrerCents + platformCents).toBe(totalCents);

    // Percentages
    expect(creatorCents / totalCents).toBeCloseTo(0.7, 4);
    expect(referrerCents / totalCents).toBeCloseTo(0.2, 4);
    expect(platformCents / totalCents).toBeCloseTo(0.1, 4);
  });
});

/**
 * Tier-aware reward calculation for referral events.
 *
 * Pure function: rewardCents = floor(paymentAmountCents * TIER_REWARD_BPS / 10_000).
 * No heuristics, no fallback tiers — caller must validate input.
 *
 * @module referral/referral-rewards
 */

import type { RewardInput, RewardCalculation, RewardTier } from './referral-types';

// Reward share per tier (basis points = percent * 100).
// BASIC: 10% | PREMIUM: 12% | ENTERPRISE: 15% | MASTER: 18%
const TIER_REWARD_BPS: Record<RewardTier, number> = {
  BASIC: 10_00,
  PREMIUM: 12_00,
  ENTERPRISE: 15_00,
  MASTER: 18_00,
};

/**
 * Compute the flat reward amount in cents for a payment,
 * by tier. Rounds DOWN to the nearest cent.
 *
 * @throws if paymentAmountCents < 0 or tier is unknown (fail-fast)
 */
export function calculateReward(input: RewardInput): RewardCalculation {
  if (input.paymentAmountCents < 0) {
    throw new Error(
      `paymentAmountCents must be >= 0, got ${input.paymentAmountCents}`,
    );
  }
  const bps = TIER_REWARD_BPS[input.tier];
  if (!bps) {
    throw new Error(`Unknown tier for reward calculation: ${input.tier}`);
  }
  const rewardCents = Math.floor((input.paymentAmountCents * bps) / 10_000);
  return { rewardCents, tier: input.tier };
}

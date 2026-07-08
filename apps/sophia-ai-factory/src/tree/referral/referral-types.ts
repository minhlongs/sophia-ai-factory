/**
 * Shared types for the referral/rewards subsystem.
 *
 * @module referral/types
 */

export type ReferralEventType = 'created' | 'clicked' | 'converted' | 'rewarded';

export interface ReferralEvent {
  id: string;
  referrerId: string;
  referredId: string | null;
  code: string;
  type: ReferralEventType;
  createdAt: string;
}

export interface ReferralRewardLedgerRow {
  id: string;
  referrerId: string;
  referredUserId: string;
  paymentId: string;
  rewardCents: number;
  createdAt: string;
}

export type RewardTier = 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

export interface RewardInput {
  tier: RewardTier;
  paymentAmountCents: number;
}

export interface RewardCalculation {
  rewardCents: number;
  tier: RewardTier;
}

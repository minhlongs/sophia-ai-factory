/**
 * Annual Commitment Service
 *
 * Implements 20% discount (equivalent to 2 months free) on annual commitments
 * across unified tiers and provides dynamic proration calculations.
 *
 * Layer: tree/billing (Pure domain service)
 *
 * @module tree/billing/annual-commitment/annual-commitment-service
 */

export {
  TIER_COMMITMENTS,
  type TierDefinition,
} from './types';

export {
  normalizeTierKey,
  resolveTierDefinition,
  calculateAnnualCommitmentQuote,
} from './discount-calculator';

export {
  calculateProratedUpgrade,
} from './schedule-builder';

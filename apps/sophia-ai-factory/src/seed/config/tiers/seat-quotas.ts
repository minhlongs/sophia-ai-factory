/**
 * Organization Tier Seat Quota Configuration
 *
 * Enforces member seat limits per subscription tier:
 * - Free: 1 seat (Solo creator)
 * - Starter: 1 seat (Solo professional)
 * - Pro: 5 seats (Collaborative team)
 * - Master: 999 seats (Enterprise / Agency)
 *
 * Layer: seed/config/tiers (Foundational)
 *
 * @module seed/config/tiers/seat-quotas
 */

export type OrgTier = 'free' | 'starter' | 'pro' | 'master';

export const TIER_SEAT_LIMITS: Record<string, number> = {
  free: 1,
  FREE: 1,
  starter: 1,
  STARTER: 1,
  basic: 1,
  BASIC: 1,
  pro: 5,
  PRO: 5,
  premium: 5,
  PREMIUM: 5,
  master: 999,
  MASTER: 999,
  enterprise: 999,
  ENTERPRISE: 999,
};

export const DEFAULT_TIER_SEAT_LIMIT = 1;

/**
 * Returns the maximum seat allocation for a given organization tier string.
 */
export function getMaxSeatsForTier(tier: string | null | undefined): number {
  if (!tier) return DEFAULT_TIER_SEAT_LIMIT;
  const normalized = tier.trim().toLowerCase();
  return TIER_SEAT_LIMITS[normalized] ?? DEFAULT_TIER_SEAT_LIMIT;
}

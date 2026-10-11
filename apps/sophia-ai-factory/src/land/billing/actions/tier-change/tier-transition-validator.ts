import { z } from 'zod';
import type { Tier } from '@/seed/types';

// ── Tier ranking ──────────────────────────────────────────────────────────

const TIER_RANK: Record<string, number> = {
  BASIC: 1,
  PREMIUM: 2,
  ENTERPRISE: 3,
  MASTER: 4,
};

const TierEnum = z.enum(['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER']);

/**
 * Validates a target tier string and ensures it's a valid enum value
 */
export function validateTargetTier(targetTierRaw: string): Tier | null {
  const parsed = TierEnum.safeParse(targetTierRaw);
  return parsed.success ? parsed.data : null;
}

/**
 * Determines if a change is a downgrade
 */
export function isDowngrade(currentTier: string, targetTier: string): boolean {
  return (TIER_RANK[targetTier] ?? 0) < (TIER_RANK[currentTier] ?? 0);
}

/**
 * Checks if a tier is Master (which requires special flow)
 */
export function isMasterTier(tier: string): boolean {
  return tier === 'MASTER';
}

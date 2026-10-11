import type { Tier } from '@/seed/types';

/**
 * Calculates prorated credit for unused time on current tier
 * @returns amount in cents to credit to the account
 */
export function calculateProRataCredit(
  currentTierPriceCents: number,
  periodStart: string,
  periodEnd: string,
): number {
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();
  const now = Date.now();

  if (now >= end || now <= start) return 0;

  const totalMs = end - start;
  const usedMs = now - start;
  const remainingRatio = 1 - usedMs / totalMs;

  return Math.max(0, Math.round(currentTierPriceCents * remainingRatio));
}

/**
 * Gets tier price handling dynamic import from config
 */
export async function getTierPriceInCents(tier: Tier): Promise<number> {
  try {
    const { UNIFIED_TIERS } = await import('@/seed/config/tiers');
    return UNIFIED_TIERS[tier]?.priceInCents ?? 0;
  } catch {
    return 0;
  }
}

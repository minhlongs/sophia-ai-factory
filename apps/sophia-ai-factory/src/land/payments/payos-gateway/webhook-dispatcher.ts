import type { Tier } from '@/seed/types';
import { UNIFIED_TIERS } from '@/seed/config/tiers/unified-limits';
import type { PayOsTierConfig } from './types';

let USD_TO_VND: number | null = null;

export function getUsdToVnd(): number {
  if (USD_TO_VND === null) {
    const usdToVndEnv = process.env.USD_TO_VND;
    if (!usdToVndEnv) {
      throw new Error('USD_TO_VND environment variable is required for PayOS');
    }
    USD_TO_VND = Number(usdToVndEnv);
  }
  return USD_TO_VND;
}

const TIER_USD_PRICES: Record<Tier, number> = {
  BASIC: UNIFIED_TIERS.BASIC.price,
  PREMIUM: UNIFIED_TIERS.PREMIUM.price,
  ENTERPRISE: UNIFIED_TIERS.ENTERPRISE.price,
  MASTER: UNIFIED_TIERS.MASTER.price,
};

export function getPayOsTierConfig(tier: Tier): PayOsTierConfig {
  const usd = TIER_USD_PRICES[tier];
  const usdToVnd = getUsdToVnd();
  const vnd = Math.round((usd * usdToVnd) / 1000) * 1000; // round to 1000 VND
  return { tier, vndAmount: vnd, usdAmount: usd };
}

/**
 * Parse userId from PayOS description field.
 * Convention: last segment of orderId embedded in description.
 * orderId format: sophia_{userId}_{ts}
 */
export function parseUserIdFromPayOsDescription(description: string): string | null {
  // Match sophia_{userId}_{ts} pattern in description
  const match = description.match(/sophia_([^_]+)_\d+/);
  return match ? match[1] : null;
}

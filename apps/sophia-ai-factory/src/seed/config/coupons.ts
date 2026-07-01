/**
 * Coupon configuration — read from PROMO_COUPON_CODES env var with fallback.
 *
 * Env var format (comma-separated):
 *   CODE:discountPercent:maxUses:expires:projects:mcuBonus
 *
 * Fields:
 *   CODE           — uppercase coupon identifier (e.g. FREE50)
 *   discountPercent — integer 0–100
 *   maxUses        — integer (9999 = unlimited)
 *   expires        — ISO date string, empty for never
 *   projects       — pipe-separated project names (sophia|mekongmind)
 *   mcuBonus       — MCU credit bonus for activate route
 *
 * Example:
 *   FREE50:100:9999::sophia|mekongmind:1000,LAUNCH25:25:100:2026-12-31:sophia|mekongmind:500
 */

export interface CouponDefinition {
  discountPercent: number;
  maxUses: number;
  expires: string | null;
  projects: string[];
  mcuBonus: number;
}

const DEFAULT_COUPON_STR =
  'FREE50:100:9999::sophia|mekongmind:1000,LAUNCH25:25:100:2026-12-31:sophia|mekongmind:500';

function parseCouponEntry(entry: string): { code: string; def: CouponDefinition } | null {
  const parts = entry.split(':');
  if (parts.length < 6) return null;
  const [code, discountPercentStr, maxUsesStr, expires, projectsStr, mcuBonusStr] = parts;
  const discountPercent = parseInt(discountPercentStr, 10);
  const maxUses = parseInt(maxUsesStr, 10);
  const mcuBonus = parseInt(mcuBonusStr, 10);
  if (isNaN(discountPercent) || isNaN(maxUses) || isNaN(mcuBonus)) return null;
  return {
    code: code.toUpperCase(),
    def: {
      discountPercent,
      maxUses,
      expires: expires || null,
      projects: projectsStr ? projectsStr.split('|').map((p) => p.trim()).filter(Boolean) : [],
      mcuBonus,
    },
  };
}

function parseCouponCodes(envValue: string | undefined): Record<string, CouponDefinition> {
  const raw = envValue || DEFAULT_COUPON_STR;
  const entries = raw.split(',').map((e) => e.trim()).filter(Boolean);
  const map: Record<string, CouponDefinition> = {};
  for (const entry of entries) {
    const parsed = parseCouponEntry(entry);
    if (parsed) {
      map[parsed.code] = parsed.def;
    }
  }
  return map;
}

let cachedCoupons: Record<string, CouponDefinition> | null = null;

/** Get all coupon definitions (cached in-memory for worker lifetime). */
export function getCouponDefinitions(): Record<string, CouponDefinition> {
  if (!cachedCoupons) {
    cachedCoupons = parseCouponCodes(
      typeof process !== 'undefined' ? process.env.PROMO_COUPON_CODES : undefined,
    );
  }
  return cachedCoupons;
}

/** Get activate-compatible coupon map (code → mcuBonus). */
export function getActivateCoupons(): Record<string, { mcuBonus: number }> {
  const all = getCouponDefinitions();
  const result: Record<string, { mcuBonus: number }> = {};
  for (const [code, def] of Object.entries(all)) {
    result[code] = { mcuBonus: def.mcuBonus };
  }
  return result;
}

/** Pricing map for tier → monthly price. */
export const PRICING: Record<string, number> = {
  BASIC: 199,
  PREMIUM: 399,
  MASTER: 799,
};

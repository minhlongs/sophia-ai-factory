/**
 * Coupon configuration — read strictly from PROMO_COUPON_CODES env var (fail-closed).
 *
 * Env var format (comma-separated):
 *   CODE:discountPercent:maxUses:expires:projects:mcuBonus
 *
 * Fields:
 *   CODE            — uppercase coupon identifier
 *   discountPercent — integer 0–100 (100 required for $0 activation)
 *   maxUses         — integer (9999 = unlimited)
 *   expires         — ISO date string, empty for never
 *   projects        — pipe-separated project names (sophia|mekongmind)
 *   mcuBonus        — MCU credit bonus for activate route
 */

export interface CouponDefinition {
  discountPercent: number;
  maxUses: number;
  expires: string | null;
  projects: string[];
  mcuBonus: number;
}

function parseCouponEntry(entry: string): { code: string; def: CouponDefinition } | null {
  const parts = entry.split(':');
  if (parts.length < 6) return null;
  const [code, discountPercentStr, maxUsesStr, expires, projectsStr, mcuBonusStr] = parts;
  const discountPercent = parseInt(discountPercentStr, 10);
  const maxUses = parseInt(maxUsesStr, 10);
  const mcuBonus = parseInt(mcuBonusStr, 10);
  if (
    !code?.trim() ||
    isNaN(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100 ||
    isNaN(maxUses) ||
    maxUses < 1 ||
    isNaN(mcuBonus) ||
    mcuBonus < 0
  ) {
    return null;
  }
  return {
    code: code.trim().toUpperCase(),
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
  const raw = envValue?.trim();
  if (!raw) return {};
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

let cachedEnvValue: string | undefined;
let cachedCoupons: Record<string, CouponDefinition> | null = null;

/** Reset cached coupon definitions (useful when env rotates in tests). */
export function resetCouponCache(): void {
  cachedCoupons = null;
  cachedEnvValue = undefined;
}

/** Get all coupon definitions (fail-closed to empty map when PROMO_COUPON_CODES is unset). */
export function getCouponDefinitions(): Record<string, CouponDefinition> {
  const currentEnv = typeof process !== 'undefined' ? process.env.PROMO_COUPON_CODES : undefined;
  if (!cachedCoupons || cachedEnvValue !== currentEnv) {
    cachedEnvValue = currentEnv;
    cachedCoupons = parseCouponCodes(currentEnv);
  }
  return cachedCoupons;
}

/** Get activate-compatible coupon map (code → full CouponDefinition). */
export function getActivateCoupons(): Record<string, CouponDefinition> {
  return getCouponDefinitions();
}

/** Pricing map for tier → monthly price. */
export const PRICING: Record<string, number> = {
  BASIC: 199,
  PREMIUM: 399,
  MASTER: 799,
};

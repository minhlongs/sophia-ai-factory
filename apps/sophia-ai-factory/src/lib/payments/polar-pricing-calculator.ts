import { PPPTier, PPPPricing } from './polar-types'

/**
 * Purchasing Power Parity (PPP) pricing calculator
 * Adjusts prices based on user's country to maximize global reach
 */

// Base prices (USD) - Tier 1 countries pay full price
const BASE_PRICES = {
  starter: 19,
  growth: 29,
  premium: 49,
}

// PPP multipliers by tier
const PPP_MULTIPLIERS: Record<PPPTier, number> = {
  1: 1.0,   // Full price (US, EU, AU, JP, KR)
  2: 0.6,   // 60% (Asia, LATAM, Eastern Europe)
  3: 0.4,   // 40% (Emerging markets)
}

// Country code → PPP tier mapping
const COUNTRY_PPP_MAP: Record<string, PPPTier> = {
  // Tier 1 - High income
  US: 1, CA: 1, GB: 1, DE: 1, FR: 1, AU: 1, NZ: 1,
  JP: 1, KR: 1, SG: 1, CH: 1, NO: 1, SE: 1, DK: 1,
  NL: 1, BE: 1, AT: 1, FI: 1, IE: 1, IT: 1, ES: 1,

  // Tier 2 - Middle income
  BR: 2, MX: 2, AR: 2, CL: 2, CO: 2, PE: 2,
  TH: 2, MY: 2, PH: 2, ID: 2, TW: 2,
  PL: 2, CZ: 2, RO: 2, HU: 2, BG: 2, HR: 2,
  TR: 2, ZA: 2, EG: 2, MA: 2,

  // Tier 3 - Emerging markets
  VN: 3, IN: 3, BD: 3, PK: 3, LK: 3, MM: 3, KH: 3, LA: 3,
  NG: 3, KE: 3, GH: 3, TZ: 3, ET: 3, UG: 3,
  UA: 3, GE: 3, AM: 3, UZ: 3,
}

/**
 * Get PPP tier for a country code
 */
export function getPPPTier(countryCode: string): PPPTier {
  return COUNTRY_PPP_MAP[countryCode.toUpperCase()] || 1
}

/**
 * Calculate PPP-adjusted pricing for a country
 */
export function calculatePPPPricing(countryCode: string): PPPPricing {
  const tier = getPPPTier(countryCode)
  const multiplier = PPP_MULTIPLIERS[tier]

  return {
    tier,
    multiplier,
    prices: {
      starter: Math.round(BASE_PRICES.starter * multiplier),
      growth: Math.round(BASE_PRICES.growth * multiplier),
      premium: Math.round(BASE_PRICES.premium * multiplier),
    },
  }
}

/**
 * Format price for display
 */
export function formatPrice(amount: number): string {
  return `$${amount}/mo`
}

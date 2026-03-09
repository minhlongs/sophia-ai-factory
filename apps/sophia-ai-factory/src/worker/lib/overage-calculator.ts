/**
 * Overage Calculator - Tiered Billing Calculation
 *
 * Calculates overage fees based on tiered pricing structure.
 * Supports BASIC, PREMIUM, and ENTERPRISE tiers with configurable rates.
 */

// Tiered pricing configuration
interface TierPricing {
  included: number;      // Included requests in base tier
  rate: number;          // Per-request overage rate in USD
  hardLimit: number;     // Maximum allowed (150% of included)
}

export interface OverageResult {
  overageCount: number;    // Number of requests over base limit
  overageFee: number;      // Total overage fee in USD
  isOverHardLimit: boolean; // Whether user exceeded hard limit
  tier: string;
  baseLimit: number;
  currentUsage: number;
  remaining: number;
}

// Tier pricing configuration
export const OVERAGE_RATES: Record<string, TierPricing> = {
  BASIC: {
    included: 1000,
    rate: 0.05,        // $0.05 per request over limit
    hardLimit: 1500    // 150% of base
  },
  PREMIUM: {
    included: 10000,
    rate: 0.03,        // $0.03 per request (volume discount)
    hardLimit: 15000
  },
  ENTERPRISE: {
    included: 100000,
    rate: 0.01,        // $0.01 per request (best rate)
    hardLimit: 150000
  }
};

/**
 * Get tier pricing with fallback to BASIC
 */
export function getTierPricing(tier: string | null | undefined): TierPricing {
  const normalizedTier = tier?.toUpperCase() || 'BASIC';
  return OVERAGE_RATES[normalizedTier] || OVERAGE_RATES.BASIC;
}

/**
 * Calculate overage fees from usage data
 *
 * @param currentUsage - Current request count for the billing period
 * @param tier - User's subscription tier (BASIC/PREMIUM/ENTERPRISE)
 * @returns Overage calculation result with fees and metadata
 */
export function calculateOverage(
  currentUsage: number,
  tier: string | null | undefined
): OverageResult {
  const pricing = getTierPricing(tier);
  const { included, rate, hardLimit } = pricing;

  // Calculate overage count (requests over base limit)
  const overageCount = Math.max(0, currentUsage - included);

  // Calculate overage fee
  const overageFee = overageCount * rate;

  // Check if over hard limit
  const isOverHardLimit = currentUsage >= hardLimit;

  // Calculate remaining requests (before hitting base limit)
  const remaining = Math.max(0, included - currentUsage);

  return {
    overageCount,
    overageFee: Math.round(overageFee * 100) / 100, // Round to 2 decimal places
    isOverHardLimit,
    tier: tier?.toUpperCase() || 'BASIC',
    baseLimit: included,
    currentUsage,
    remaining
  };
}

/**
 * Calculate cost to upgrade to next tier
 * Useful for showing users potential savings
 */
export function calculateUpgradeSavings(
  currentUsage: number,
  currentTier: string
): { currentOverage: number; nextTier: string | null; savings: number } {
  const tierOrder = ['BASIC', 'PREMIUM', 'ENTERPRISE'];
  const currentIndex = tierOrder.indexOf(currentTier.toUpperCase());

  // No upgrade available for ENTERPRISE
  if (currentIndex === -1 || currentIndex >= tierOrder.length - 1) {
    return {
      currentOverage: calculateOverage(currentUsage, currentTier).overageFee,
      nextTier: null,
      savings: 0
    };
  }

  const nextTier = tierOrder[currentIndex + 1];
  const currentResult = calculateOverage(currentUsage, currentTier);
  const nextResult = calculateOverage(currentUsage, nextTier);

  return {
    currentOverage: currentResult.overageFee,
    nextTier,
    savings: currentResult.overageFee - nextResult.overageFee
  };
}

/**
 * Format overage fee as currency string
 */
export function formatOverageFee(fee: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(fee);
}

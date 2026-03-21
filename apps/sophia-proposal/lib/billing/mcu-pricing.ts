/**
 * MCU Pricing Calculator
 *
 * Handles:
 * - MCU cost calculations for features
 * - Overage pricing
 * - Tier-based discounts
 */

import { POLAR_TIERS, PolarTier } from './polar-client';

export interface McuCostConfig {
  feature: string;
  baseCost: number;
  tier?: 'starter' | 'growth' | 'premium' | 'master';
}

// Feature cost definitions
export const MCU_COSTS: Record<string, number> = {
  // AI Proposal Generation
  'proposal:text:basic': 10,      // Basic text proposal
  'proposal:text:advanced': 25,   // Advanced with custom sections
  'proposal:text:enterprise': 50, // Enterprise with analytics

  // Video Generation (HeyGen)
  'video:intro': 100,         // 30s intro
  'video:section': 250,       // 60s section
  'video:full_proposal': 500, // 2-3min full proposal
  'video:custom': 100,        // Custom video
  'video:custom_avatar': 50,  // Custom avatar addon

  // Affiliate content generation
  'affiliate:blog': 50,   // SEO review blog post
  'affiliate:video': 200, // HeyGen video review
  'affiliate:social': 10, // LinkedIn + Twitter + TikTok bundle

  // Other features
  'template:custom': 50,  // Custom template creation
  'export:pdf': 5,        // PDF export
  'export:html': 2,       // HTML export
  'api:call': 1,          // Per API call
  'affiliate:scrape': 5,  // Trigger affiliate program scraper
};

/**
 * Calculate MCU cost for a feature with tier discount
 */
export function calculateMcuCost(
  feature: string,
  tierName?: string
): number {
  const baseCost = MCU_COSTS[feature] || 0;

  if (!tierName) {
    return baseCost;
  }

  const tier = POLAR_TIERS[tierName];
  if (!tier) {
    return baseCost;
  }

  // Apply tier discount (higher tiers = lower costs)
  const discounts: Record<string, number> = {
    starter: 1.0,    // No discount
    growth: 0.9,     // 10% off
    premium: 0.8,    // 20% off
    master: 0.7,     // 30% off
  };

  const discount = discounts[tierName] || 1.0;
  return Math.floor(baseCost * discount);
}

/**
 * Calculate overage cost in USD
 */
export function calculateOverageCost(
  mcuUsed: number,
  tierName: string
): number {
  const tier = POLAR_TIERS[tierName];
  if (!tier) {
    return 0;
  }

  const overageMcu = Math.max(0, mcuUsed - tier.mcuMonthly);
  return overageMcu * tier.mcuOverageRate;
}

/**
 * Get tier by Polar product ID
 */
export function getTierByProductId(productId: string): PolarTier | null {
  return Object.values(POLAR_TIERS).find(
    tier => tier.polarProductId === productId
  ) || null;
}

/**
 * Get tier name from price
 */
export function getTierByPrice(price: number): string | null {
  const tier = Object.values(POLAR_TIERS).find(
    t => t.price === price
  );
  return tier?.name || null;
}

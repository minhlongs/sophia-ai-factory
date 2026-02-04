import { Tier, TierConfig, FeatureFlag } from "@/types";

/**
 * Tier configurations for Sophia AI Video Factory
 * Pricing for KOL Content Factory service:
 * - Starter: $1,200 (setup only)
 * - Growth: $2,000 (setup + automation) ⭐ RECOMMENDED
 * - Premium: $3,000 (full package)
 */

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  BASIC: {
    name: "Starter",
    price: 1200, // $1,200 USD
    priceDisplay: "$1,200",
    features: [
      // Starter tier - basic setup
    ],
    limits: {
      youtubeChannels: 1,
      videoTemplates: 5,
      trainingSessions: 2,
      supportMonths: 1,
    },
  },

  PREMIUM: {
    name: "Growth",
    price: 2000, // $2,000 USD
    priceDisplay: "$2,000",
    recommended: true,
    features: [
      "enable_affiliate_engine",
      "enable_roi_calculator",
    ],
    limits: {
      youtubeChannels: 3,
      videoTemplates: 10,
      trainingSessions: 4,
      supportMonths: 3,
      automationScripts: true,
      affiliateDashboard: true,
    },
  },

  ENTERPRISE: {
    name: "Premium",
    price: 3000, // $3,000 USD
    priceDisplay: "$3,000",
    features: [
      "enable_affiliate_engine",
      "enable_admin_dashboard",
      "enable_roi_calculator",
      "enable_api_integrations",
      "enable_auto_update",
    ],
    limits: {
      youtubeChannels: 5,
      videoTemplates: 20,
      trainingSessions: 8,
      supportMonths: 6,
      automationScripts: true,
      affiliateDashboard: true,
      seoOptimization: true,
      monthlyStrategyCalls: true,
    },
  },
};

/**
 * Get tier configuration
 */
export function getTierConfig(tier: Tier): TierConfig {
  return TIER_CONFIGS[tier];
}

/**
 * Check if a tier includes a specific feature
 */
export function tierHasFeature(tier: Tier, feature: FeatureFlag): boolean {
  return TIER_CONFIGS[tier].features.includes(feature);
}

/**
 * Get all available tiers
 */
export function getAllTiers(): Tier[] {
  return Object.keys(TIER_CONFIGS) as Tier[];
}

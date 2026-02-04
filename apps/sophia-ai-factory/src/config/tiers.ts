import { Tier, TierConfig, FeatureFlag } from "@/types";

/**
 * Tier configurations for Sophia AI Video Factory
 * Pricing for KOL Content Factory service:
 * - Starter: 30 triệu VND (setup only)
 * - Growth: 50 triệu VND (setup + automation) ⭐ RECOMMENDED
 * - Premium: 75 triệu VND (full package)
 */

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  BASIC: {
    name: "Starter",
    price: 30000000, // 30 triệu VND
    priceDisplay: "30 triệu",
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
    price: 50000000, // 50 triệu VND
    priceDisplay: "50 triệu",
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
    price: 75000000, // 75 triệu VND
    priceDisplay: "75 triệu",
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

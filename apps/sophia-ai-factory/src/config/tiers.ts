import { Tier, TierConfig, FeatureFlag } from "@/types";

/**
 * Tier configurations for Sophia AI Video Factory
 * Pricing - Monthly subscriptions (12-month commitment):
 * - Starter: $199/mo (basic setup)
 * - Growth: $399/mo (scale production) ⭐ RECOMMENDED
 * - Premium: $799/mo (enterprise power)
 * - Master: $4,999 one-time (lifetime access)
 */

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  BASIC: {
    name: "Starter",
    price: 199, // $199/mo USD
    priceDisplay: "$199/mo",
    polarProductId: process.env.POLAR_PRODUCT_ID_STARTER,
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
    price: 399, // $399/mo USD
    priceDisplay: "$399/mo",
    polarProductId: process.env.POLAR_PRODUCT_ID_GROWTH,
    recommended: true,
    features: [
      "enable_affiliate_engine",
      "enable_roi_calculator",
    ],
    limits: {
      youtubeChannels: 3,
      videoTemplates: 999, // Unlimited
      trainingSessions: 4,
      supportMonths: 3,
      automationScripts: true,
      affiliateDashboard: true,
    },
  },

  ENTERPRISE: {
    name: "Premium",
    price: 799, // $799/mo USD
    priceDisplay: "$799/mo",
    polarProductId: process.env.POLAR_PRODUCT_ID_PREMIUM,
    features: [
      "enable_affiliate_engine",
      "enable_admin_dashboard",
      "enable_roi_calculator",
      "enable_api_integrations",
      "enable_auto_update",
    ],
    limits: {
      youtubeChannels: 999, // Unlimited
      videoTemplates: 999,  // Unlimited custom templates
      trainingSessions: 8,
      supportMonths: 6,
      automationScripts: true,
      affiliateDashboard: true,
      seoOptimization: true,
      monthlyStrategyCalls: true,
    },
  },

  MASTER: {
    name: "Master",
    price: 4999, // $4,999 USD one-time
    priceDisplay: "$4,999",
    polarProductId: process.env.POLAR_PRODUCT_ID_MASTER,
    features: [
      "enable_affiliate_engine",
      "enable_admin_dashboard",
      "enable_roi_calculator",
      "enable_api_integrations",
      "enable_auto_update",
    ],
    limits: {
      youtubeChannels: 999, // Unlimited
      videoTemplates: 999,  // Unlimited custom templates
      trainingSessions: 999, // Unlimited lifetime
      supportMonths: 999,   // Lifetime VIP support
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

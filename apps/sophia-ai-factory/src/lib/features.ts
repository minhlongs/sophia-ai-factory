import { Tier, FeatureFlag, AccessCheck } from "@/types";
import { tierHasFeature } from "@/config/tiers";
import { getFeatureFlag } from "@/config/flags";

/**
 * Feature access control - checks if a tier has access to a feature
 * Combines tier entitlements with feature flags
 */

/**
 * Check if a tier has access to a specific feature
 * Returns detailed access check result
 */
export function checkTierAccess(
  tier: Tier,
  feature: FeatureFlag
): AccessCheck {
  // First check if feature is globally enabled
  const featureEnabled = getFeatureFlag(feature);

  if (!featureEnabled) {
    return {
      hasAccess: false,
      reason: "Feature is currently disabled",
    };
  }

  // Then check if tier includes this feature
  const tierHasAccess = tierHasFeature(tier, feature);

  if (!tierHasAccess) {
    // Determine which tier is required for this feature
    const requiredTier = getRequiredTierForFeature(feature);

    return {
      hasAccess: false,
      reason: `This feature requires ${requiredTier} tier or higher`,
      requiredTier,
    };
  }

  return {
    hasAccess: true,
  };
}

/**
 * Simple boolean check - convenience wrapper
 */
export function hasTierAccess(tier: Tier, feature: FeatureFlag): boolean {
  return checkTierAccess(tier, feature).hasAccess;
}

/**
 * Get the minimum tier required for a feature
 */
function getRequiredTierForFeature(feature: FeatureFlag): Tier {
  // ROI Calculator: Premium+
  if (feature === "enable_roi_calculator") return "PREMIUM";

  // Affiliate Engine: Premium+
  if (feature === "enable_affiliate_engine") return "PREMIUM";

  // Admin Dashboard: Enterprise only
  if (feature === "enable_admin_dashboard") return "ENTERPRISE";

  // API Integrations: Enterprise only
  if (feature === "enable_api_integrations") return "ENTERPRISE";

  // Auto Update: Enterprise only
  if (feature === "enable_auto_update") return "ENTERPRISE";

  return "BASIC"; // Default
}

/**
 * Get all accessible features for a tier
 */
export function getAccessibleFeatures(tier: Tier): FeatureFlag[] {
  const allFeatures: FeatureFlag[] = [
    "enable_affiliate_engine",
    "enable_admin_dashboard",
    "enable_roi_calculator",
    "enable_api_integrations",
    "enable_auto_update",
  ];

  return allFeatures.filter((feature) => hasTierAccess(tier, feature));
}

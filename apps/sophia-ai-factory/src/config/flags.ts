import { FeatureFlag, Tier } from "@/types";

/**
 * PayOS VN payment method feature flag.
 * Default false — enable only when PayOS integration is fully implemented.
 */
export const FEATURE_PAYOS = process.env.FEATURE_PAYOS === 'true';

/**
 * Feature flag configuration
 * Supports environment variable overrides via NEXT_PUBLIC_FEATURE_*
 */

export type FlagConfig = {
  name: string;
  description: string;
  defaultEnabled: boolean;
  requiredTier: Tier;
};

type FeatureFlagConfig = {
  [key in FeatureFlag]: {
    enabled: boolean;
    description: string;
  };
};

export const FEATURE_FLAGS: Record<FeatureFlag, FlagConfig> = {
  enable_affiliate_engine: {
    name: "Affiliate Discovery Engine",
    description: "Enable the affiliate discovery engine and program listings",
    defaultEnabled: true,
    requiredTier: "BASIC",
  },
  enable_admin_dashboard: {
    name: "Admin Dashboard",
    description: "Enable the /admin dashboard for tier management",
    defaultEnabled: true,
    requiredTier: "ENTERPRISE",
  },
  enable_roi_calculator: {
    name: "ROI Calculator",
    description: "Enable the ROI calculator tool on landing page",
    defaultEnabled: true,
    requiredTier: "BASIC",
  },
  enable_api_integrations: {
    name: "API Integrations",
    description: "Enable API integrations with PartnerStack, Impact.com, etc.",
    defaultEnabled: true,
    requiredTier: "ENTERPRISE",
  },
  enable_auto_update: {
    name: "Auto-Update",
    description: "Enable weekly auto-update of affiliate programs",
    defaultEnabled: false,
    requiredTier: "ENTERPRISE",
  },
  enable_early_access: {
    name: "Early Access",
    description: "Early access to beta features for Master tier users",
    defaultEnabled: true,
    requiredTier: "MASTER",
  },
};

const DEFAULT_FLAGS: FeatureFlagConfig = {
  enable_affiliate_engine: {
    enabled: true,
    description: "Enable the affiliate discovery engine and program listings",
  },
  enable_admin_dashboard: {
    enabled: true,
    description: "Enable the /admin dashboard for tier management",
  },
  enable_roi_calculator: {
    enabled: true,
    description: "Enable the ROI calculator tool on landing page",
  },
  enable_api_integrations: {
    enabled: true,
    description: "Enable API integrations with PartnerStack, Impact.com, etc.",
  },
  enable_auto_update: {
    enabled: false, // Future feature - disabled by default
    description: "Enable weekly auto-update of affiliate programs",
  },
  enable_early_access: {
    enabled: true,
    description: "Early access to beta features for Master tier users",
  },
};

/**
 * Get feature flag value with environment variable override support
 * Usage: NEXT_PUBLIC_FEATURE_ADMIN_DASHBOARD=false
 */
export function getFeatureFlag(flag: FeatureFlag): boolean {
  // Check for environment variable override
  const envKey = `NEXT_PUBLIC_FEATURE_${flag.toUpperCase().replace(/^ENABLE_/, "")}`;
  const envValue = process.env[envKey];

  if (envValue !== undefined) {
    return envValue === "true" || envValue === "1";
  }

  // Return default value (unknown flags default to true)
  return DEFAULT_FLAGS[flag]?.enabled ?? true;
}

/**
 * Get all feature flags with their current state
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags = {} as Record<FeatureFlag, boolean>;

  Object.keys(DEFAULT_FLAGS).forEach((key) => {
    flags[key as FeatureFlag] = getFeatureFlag(key as FeatureFlag);
  });

  return flags;
}

/**
 * Get feature flag description
 */
export function getFeatureFlagDescription(flag: FeatureFlag): string {
  return DEFAULT_FLAGS[flag]?.description ?? flag;
}

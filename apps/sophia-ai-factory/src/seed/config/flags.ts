import type { FeatureFlag } from "@/seed/types";
import { FEATURE_FLAGS, type FlagConfig } from "./flags-catalog";

export { FEATURE_FLAGS, type FlagConfig };

/**
 * PayOS VN payment method feature flag.
 * Default false — enable only when PayOS integration is fully implemented.
 */
export const FEATURE_PAYOS = process.env.FEATURE_PAYOS === 'true';

/**
 * Get feature flag value with environment variable override support
 * Usage: NEXT_PUBLIC_FEATURE_ADMIN_DASHBOARD=false
 */
export function getFeatureFlag(flag: FeatureFlag): boolean {
  const envKey = `NEXT_PUBLIC_FEATURE_${flag.toUpperCase().replace(/^ENABLE_/, "")}`;
  const envValue = process.env[envKey];

  if (envValue !== undefined) {
    return envValue === "true" || envValue === "1";
  }

  return FEATURE_FLAGS[flag]?.defaultEnabled ?? true;
}

/**
 * Get all feature flags with their current state
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  const flags = {} as Record<FeatureFlag, boolean>;

  Object.keys(FEATURE_FLAGS).forEach((key) => {
    flags[key as FeatureFlag] = getFeatureFlag(key as FeatureFlag);
  });

  return flags;
}

/**
 * Get feature flag description
 */
export function getFeatureFlagDescription(flag: FeatureFlag): string {
  return FEATURE_FLAGS[flag]?.description ?? flag;
}

import { Tier } from "@/seed/types";
import { getTierConfig, UNIFIED_TIERS, type UnifiedTierLimits } from "@/seed/config/tiers";
import { resolveUserTier } from "@/seed/db/resolve-user-tier";

// ─── Shared types ──────────────────────────────────────────────────────────────

export type LimitType =
  | "youtubeChannels"
  | "videoTemplates"
  | "trainingSessions"
  | "automationScripts"
  | "affiliateDashboard"
  | "adminDashboard"
  | "apiAccess"
  | "earlyAccess";

export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  currentusage: number;
  requiredTier: Tier;
  currentTier?: Tier;
  message?: string;
}

// ─── Shared tier-feature gate ──────────────────────────────────────────────────

export type BooleanTierFeature = keyof Pick<
  UnifiedTierLimits,
  "apiAccess" | "webhooks" | "customIntegrations" | "whiteLabel"
>;

/**
 * Check if user's tier allows a specific boolean feature.
 * Uses UNIFIED_TIERS config fields: apiAccess, webhooks, customIntegrations, whiteLabel.
 */
export async function checkTierFeature(
  userId: string,
  feature: BooleanTierFeature
): Promise<{ allowed: boolean; tier: Tier; requiredTier: string }> {
  const tier = await resolveUserTier(userId);
  const limits = UNIFIED_TIERS[tier];
  const allowed = !!limits[feature];

  const allTiers: Tier[] = ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"];
  const requiredTierKey = allTiers.find((t) => !!UNIFIED_TIERS[t][feature]) ?? "MASTER";

  return { allowed, tier, requiredTier: UNIFIED_TIERS[requiredTierKey].name };
}

// ─── Shared limit checker ──────────────────────────────────────────────────────

/**
 * Core limit-check logic shared by land and forest tier guards.
 *
 * @param userId        - User to check
 * @param limitType     - Resource type to check
 * @param currentUsage  - Caller-supplied usage count (land passes dynamic count for videoTemplates; forest passes 0)
 */
export async function checkLimit(
  userId: string,
  limitType: LimitType,
  currentUsage: number
): Promise<LimitCheckResult> {
  const userTier = await resolveUserTier(userId);
  const config = getTierConfig(userTier);

  let limit = 0;
  let requiredTier: Tier = "PREMIUM";

  // MASTER tier always has maximum access
  if (userTier === "MASTER") {
    return {
      allowed: true,
      limit: Infinity,
      currentusage: 0,
      requiredTier: "MASTER",
    };
  }

  switch (limitType) {
    case "youtubeChannels":
      limit = config.limits.youtubeChannels;
      // Architecture note: the current data model stores ONE set of YouTube
      // credentials per user in user_profiles.api_keys.youtube (Supabase).
      // This inherently enforces the BASIC=1 channel limit by design.
      currentUsage = 0; // limit check at OAuth callback is the real gate
      if (userTier === "BASIC") requiredTier = "PREMIUM";
      else if (userTier === "PREMIUM") requiredTier = "ENTERPRISE";
      break;

    case "videoTemplates":
      limit = config.limits.videoTemplates;
      // currentUsage is passed in by the caller (land counts custom templates dynamically)
      if (userTier === "BASIC") requiredTier = "PREMIUM";
      else if (userTier === "PREMIUM") requiredTier = "ENTERPRISE";
      break;

    case "automationScripts":
      limit = config.limits.automationScripts ? Infinity : 0;
      currentUsage = 0; // Boolean feature
      requiredTier = "PREMIUM";
      break;

    case "affiliateDashboard":
      limit = config.limits.affiliateDashboard ? Infinity : 0;
      currentUsage = 0; // Boolean feature
      requiredTier = "PREMIUM";
      break;

    case "adminDashboard":
      limit = config.features.includes("enable_admin_dashboard") ? Infinity : 0;
      currentUsage = 0;
      requiredTier = "ENTERPRISE";
      break;

    case "apiAccess":
      limit = config.features.includes("enable_api_integrations") ? Infinity : 0;
      currentUsage = 0;
      requiredTier = "ENTERPRISE";
      break;

    case "earlyAccess":
      limit = config.features.includes("enable_early_access") ? Infinity : 0;
      currentUsage = 0;
      requiredTier = "MASTER";
      break;

    case "trainingSessions":
      limit = config.limits.trainingSessions ?? 0;
      currentUsage = 0; // Would count actual training sessions in production
      requiredTier = "ENTERPRISE";
      break;
  }

  const allowed = currentUsage < limit;

  return {
    allowed,
    limit,
    currentusage: currentUsage,
    requiredTier,
    message: allowed
      ? undefined
      : `You have reached the limit for ${limitType}. Upgrade to ${requiredTier} for more.`,
  };
}

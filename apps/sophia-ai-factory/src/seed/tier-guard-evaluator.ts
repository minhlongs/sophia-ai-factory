import type { Tier } from "@/seed/types";
import { getTierConfig } from "@/seed/config/tiers";
import type { LimitType } from "./tier-guard";

export interface EvaluatedLimitRule {
  limit: number;
  requiredTier: Tier;
  effectiveUsage: number;
}

/**
 * Resolves the configured numeric/boolean limit and upgrade target tier
 * for a given user tier and limitType.
 */
export function evaluateTierLimitRule(
  userTier: Tier,
  limitType: LimitType,
  currentUsage: number
): EvaluatedLimitRule {
  const config = getTierConfig(userTier);
  let limit = 0;
  let requiredTier: Tier = "PREMIUM";
  let effectiveUsage = currentUsage;

  switch (limitType) {
    case "youtubeChannels":
      limit = config.limits.youtubeChannels;
      effectiveUsage = 0;
      if (userTier === "BASIC") requiredTier = "PREMIUM";
      else if (userTier === "PREMIUM") requiredTier = "ENTERPRISE";
      break;

    case "videoTemplates":
      limit = config.limits.videoTemplates;
      if (userTier === "BASIC") requiredTier = "PREMIUM";
      else if (userTier === "PREMIUM") requiredTier = "ENTERPRISE";
      break;

    case "automationScripts":
      limit = config.limits.automationScripts ? Infinity : 0;
      effectiveUsage = 0;
      requiredTier = "PREMIUM";
      break;

    case "affiliateDashboard":
      limit = config.limits.affiliateDashboard ? Infinity : 0;
      effectiveUsage = 0;
      requiredTier = "PREMIUM";
      break;

    case "adminDashboard":
      limit = config.features.includes("enable_admin_dashboard") ? Infinity : 0;
      effectiveUsage = 0;
      requiredTier = "ENTERPRISE";
      break;

    case "apiAccess":
      limit = config.features.includes("enable_api_integrations") ? Infinity : 0;
      effectiveUsage = 0;
      requiredTier = "ENTERPRISE";
      break;

    case "earlyAccess":
      limit = config.features.includes("enable_early_access") ? Infinity : 0;
      effectiveUsage = 0;
      requiredTier = "MASTER";
      break;

    case "trainingSessions":
      limit = config.limits.trainingSessions ?? 0;
      effectiveUsage = 0;
      requiredTier = "ENTERPRISE";
      break;
  }

  return { limit, requiredTier, effectiveUsage };
}

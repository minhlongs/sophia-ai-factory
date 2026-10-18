import { Tier } from "@/seed/types";
import { UNIFIED_TIERS, type UnifiedTierLimits } from "@/seed/config/tiers";
import { resolveUserTier } from "@/seed/db/resolve-user-tier";
import { evaluateTierLimitRule } from "./tier-guard-evaluator";

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

  // MASTER tier always has maximum access
  if (userTier === "MASTER") {
    return {
      allowed: true,
      limit: Infinity,
      currentusage: 0,
      requiredTier: "MASTER",
    };
  }

  const { limit, requiredTier, effectiveUsage } = evaluateTierLimitRule(
    userTier,
    limitType,
    currentUsage
  );

  const allowed = effectiveUsage < limit;

  return {
    allowed,
    limit,
    currentusage: effectiveUsage,
    requiredTier,
    message: allowed
      ? undefined
      : `You have reached the limit for ${limitType}. Upgrade to ${requiredTier} for more.`,
  };
}

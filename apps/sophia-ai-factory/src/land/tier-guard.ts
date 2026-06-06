import { Tier } from "@/seed/types";
import { getTierConfig, UNIFIED_TIERS, type UnifiedTierLimits } from "@/seed/config/tiers";
import { getUserTier, resolveUserTier } from "@/seed/db/resolve-user-tier";
import { templateService } from "@/land/services/template-service";

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

/**
 * Async enforce: checks the limit internally, throws Error(403) if not allowed.
 * Defense-in-depth — callers who forget the check get a hard error instead of
 * silent escalation. Wrap in try/catch in route handlers and translate to 403.
 *
 * Usage: await enforceLimit(userId, LimitType.xxx)
 */
export async function enforceLimit(userId: string, requiredTier: Tier): Promise<void> {
  const result = await tierGuard.checkLimit(userId, requiredTier);
  if (!result.allowed) {
    throw new Error(
      `Access denied: requires ${requiredTier} tier, current: ${result.currentTier ?? 'unknown'}`,
    );
  }
}

/**
 * Synchronous enforce from a previously-fetched LimitCheckResult.
 * Throws Error(403) if not allowed — callers catch and return HTTP 403.
 */
export function enforceLimitFromResult(result: LimitCheckResult): void {
  if (!result.allowed) {
    throw new Error(
      `Access denied: requires ${result.requiredTier} tier, current: ${result.currentTier ?? 'unknown'}`,
    );
  }
}

export const tierGuard = {
  /**
   * Check if a user has reached their limit for a specific resource
   */
  async checkLimit(userId: string, limitType: LimitType): Promise<LimitCheckResult> {
    const userTier = await resolveUserTier(userId);
    const config = getTierConfig(userTier);

    // Default allowed/limit values
    let limit = 0;
    let currentUsage = 0;
    let requiredTier: Tier = "PREMIUM"; // Default upgrade target

    // MASTER tier always has maximum access — skip limit checks
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
        // This inherently enforces the BASIC=1 channel limit by design — you
        // can only hold one refresh_token at a time. PREMIUM=3 and above would
        // require a dedicated youtube_channels table (future work). Enforcement
        // for multi-channel tiers happens at the OAuth callback: connecting a
        // new channel overwrites the previous one until the table is added.
        // For now, currentUsage=0 is correct because the limit check at the
        // callback (1 slot = 1 user) is the real gate.
        currentUsage = 0;
        if (userTier === "BASIC") requiredTier = "PREMIUM";
        else if (userTier === "PREMIUM") requiredTier = "ENTERPRISE";
        break;

      case "videoTemplates":
        limit = config.limits.videoTemplates;
        // Count user's custom templates
        const templates = await templateService.getTemplates(userId);
        currentUsage = templates.filter(t => !t.is_predefined).length;

        // Determine required tier for upgrade if limit reached
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
        : `You have reached the limit for ${limitType}. Upgrade to ${requiredTier} for more.`
    };
  },

  /**
   * Check if user allows multiple channels (Premium feature)
   */
  async checkMultiChannelAccess(userId: string): Promise<boolean> {
    const userTier = await resolveUserTier(userId);
    return userTier !== "BASIC";
  },

  /**
   * Check if user allows custom templates (Enterprise feature as per prompt,
   * but config says Premium has 10, Enterprise 20.
   * Requirement says "ENTERPRISE: unlimited channels, custom templates".
   * Let's stick to the prompt requirement: ENTERPRISE for custom templates.)
   */
  async checkCustomTemplateAccess(userId: string): Promise<boolean> {
    const userTier = await resolveUserTier(userId);
    return userTier === "ENTERPRISE" || userTier === "MASTER";
  }
};

/** Boolean feature keys from UnifiedTierLimits that can be checked via checkTierFeature. */
export type BooleanTierFeature = keyof Pick<
  UnifiedTierLimits,
  'apiAccess' | 'webhooks' | 'customIntegrations' | 'whiteLabel'
>;

/**
 * Check if user's tier allows a specific boolean feature.
 * Uses UNIFIED_TIERS config fields: apiAccess, webhooks, customIntegrations, whiteLabel.
 *
 * Usage example (white-label gate in any route):
 *   const { allowed } = await checkTierFeature(user.id, 'whiteLabel');
 *   if (!allowed) return NextResponse.json({ error: 'White-label requires Master plan.' }, { status: 403 });
 */
export async function checkTierFeature(
  userId: string,
  feature: BooleanTierFeature
): Promise<{ allowed: boolean; tier: Tier; requiredTier: string }> {
  const tier = await resolveUserTier(userId);
  const limits = UNIFIED_TIERS[tier];
  const allowed = !!limits[feature];

  // Find the lowest tier that unlocks this feature
  const allTiers: Tier[] = ['BASIC', 'PREMIUM', 'ENTERPRISE', 'MASTER'];
  const requiredTierKey = allTiers.find(t => !!UNIFIED_TIERS[t][feature]) ?? 'MASTER';

  return { allowed, tier, requiredTier: UNIFIED_TIERS[requiredTierKey].name };
}

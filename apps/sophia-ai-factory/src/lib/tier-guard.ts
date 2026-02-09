import { Tier } from "@/types";
import { getTierConfig } from "@/config/tiers";
import { getUserTier } from "@/lib/subscription";
import { templateService } from "@/lib/services/template-service";

export type LimitType =
  | "youtubeChannels"
  | "videoTemplates"
  | "trainingSessions"
  | "automationScripts"
  | "affiliateDashboard"
  | "adminDashboard"
  | "apiAccess";

export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  currentusage: number;
  requiredTier: Tier;
  message?: string;
}

export const tierGuard = {
  /**
   * Check if a user has reached their limit for a specific resource
   */
  async checkLimit(userId: string, limitType: LimitType): Promise<LimitCheckResult> {
    const userTier = await getUserTier(userId);
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
        // In a real app, we would count actual connected channels
        currentUsage = 0; // Placeholder
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
    const userTier = await getUserTier(userId);
    return userTier !== "BASIC";
  },

  /**
   * Check if user allows custom templates (Enterprise feature as per prompt,
   * but config says Premium has 10, Enterprise 20.
   * Requirement says "ENTERPRISE: unlimited channels, custom templates".
   * Let's stick to the prompt requirement: ENTERPRISE for custom templates.)
   */
  async checkCustomTemplateAccess(userId: string): Promise<boolean> {
    const userTier = await getUserTier(userId);
    return userTier === "ENTERPRISE" || userTier === "MASTER";
  }
};

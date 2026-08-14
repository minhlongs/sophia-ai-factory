import { Tier } from "@/seed/types";
import { type UnifiedTierLimits } from "@/seed/config/tiers";
import { resolveUserTier } from "@/seed/db/resolve-user-tier";
import {
  checkLimit as seedCheckLimit,
  checkTierFeature,
  type LimitType,
  type LimitCheckResult,
  type BooleanTierFeature,
} from "@/seed/tier-guard";

export interface LimitCheckResultWithTier extends LimitCheckResult {
  currentTier?: Tier;
}

export async function enforceLimit(userId: string, limitType: LimitType): Promise<void> {
  const result = await tierGuard.checkLimit(userId, limitType);
  if (!result.allowed) {
    throw new Error(
      `Access denied: requires ${limitType} tier, current: ${result.currentTier ?? "unknown"}`,
    );
  }
}

export function enforceLimitFromResult(result: LimitCheckResult): void {
  if (!result.allowed) {
    throw new Error(
      `Access denied: requires ${result.requiredTier} tier, current: ${result.currentTier ?? "unknown"}`,
    );
  }
}

export const tierGuard = {
  async checkLimit(userId: string, limitType: LimitType): Promise<LimitCheckResultWithTier> {
    const userTier = await resolveUserTier(userId);
    let currentUsage = 0;

    if (limitType === "videoTemplates") {
      const { templateService } = await import("@/land/services/template-service");
      const templates = await templateService.getTemplates(userId);
      currentUsage = templates.filter((t) => !t.is_predefined).length;
    }

    return seedCheckLimit(userId, limitType, currentUsage) as Promise<LimitCheckResultWithTier>;
  },

  async checkMultiChannelAccess(userId: string): Promise<boolean> {
    const userTier = await resolveUserTier(userId);
    return userTier !== "BASIC";
  },

  async checkCustomTemplateAccess(userId: string): Promise<boolean> {
    const userTier = await resolveUserTier(userId);
    return userTier === "ENTERPRISE" || userTier === "MASTER";
  },
};

export { checkTierFeature, type BooleanTierFeature, type LimitType, type LimitCheckResult };

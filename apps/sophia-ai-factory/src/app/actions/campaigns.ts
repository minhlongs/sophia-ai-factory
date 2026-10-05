"use server";

/**
 * Server Action: campaigns
 *
 * Thin controller for campaign creation and user offer retrieval.
 * Delegates data operations and quota checks to Land campaigns domain service.
 */

import { resolveOrgId } from "@/seed/auth/workspace-access";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { resolveUserTier } from "@/seed/db/resolve-user-tier";
import { createServerClient, getD1 } from "@/seed/db/client";
import {
  createCampaignSchema,
  sendCampaignCreatedEvent,
  checkMonthlyCampaignLimit,
  insertCampaignRecord,
  linkAffiliateOffer,
} from "@/land/campaigns";
import { revalidatePath } from "next/cache";
import { tierGuard } from "@/land/tier-guard";
import { toError } from "@/seed/utils/to-error";
import { logger } from "@/seed/utils/logger-utility";

export async function createCampaign(formData: FormData) {
  const offerId = formData.get("offer_id") as string | null;
  const rawData = {
    title: formData.get("title") || formData.get("topic"),
    topic: formData.get("topic"),
    audience: formData.get("audience"),
    platforms: formData.getAll("platforms"),
  };

  const templateId = formData.get("template_id") as string | null;

  const validation = createCampaignSchema.safeParse(rawData);
  if (!validation.success) {
    return { success: false, message: validation.error.message };
  }

  const { title, topic, audience } = validation.data;
  const platforms = rawData.platforms as string[];

  let userId: string | undefined = undefined;
  try {
    const user = await getCurrentUser();
    if (user) userId = user.id;
  } catch {
    /* Auth session check failed */
  }

  if (!userId) {
    return { success: false, message: "Vui lòng đăng nhập để tạo chiến dịch." };
  }

  // Validate org membership — prevents actions from touching org-scoped tables without membership
  const db = createServerClient();
  const orgId = await resolveOrgId(userId, db);

  if (!orgId) {
    return { success: false, message: "Forbidden: user is not a member of any organization" };
  }

  const d1db = await getD1();
  if (!d1db) throw new Error("D1 database binding not available");

  // TIER CHECK: Multi-channel access
  if (platforms && platforms.length > 1) {
    const multiChannelAccess = await tierGuard.checkMultiChannelAccess(userId);
    if (!multiChannelAccess) {
      return {
        success: false,
        message: "Multi-channel distribution requires a PREMIUM subscription.",
        requiresUpgrade: true,
        requiredTier: "PREMIUM",
      };
    }
  }

  const tier = await resolveUserTier(userId);

  // TIER CHECK: Monthly campaign limit (delegated to Land campaign domain service)
  const limitCheck = await checkMonthlyCampaignLimit(userId, tier);
  if (!limitCheck.allowed) {
    return {
      success: false,
      message: `Monthly campaign limit reached (${limitCheck.monthLimit}). Upgrade your plan for more.`,
      requiresUpgrade: true,
    };
  }

  try {
    const campaignId = crypto.randomUUID();

    // Insert campaign record via Land domain service
    const insertResult = await insertCampaignRecord({
      campaignId,
      userId,
      title: title!,
      topic: topic || "",
      audience: audience || "",
      templateId,
    });

    if (!insertResult.success) {
      return { success: false, message: insertResult.error || "Failed to create campaign" };
    }

    // Insert affiliate offer selection via Land domain service
    if (offerId) {
      await linkAffiliateOffer(campaignId, userId, offerId);
    }

    // A/B variant generation — best-effort, failure does not block campaign
    let abExperimentId: string | undefined;
    try {
      const { generateVariants } = await import("@/forest/ab/variant-generator");
      const { createExperiment } = await import("@/forest/ab/experiment-store");
      const { resolveUserApiKey } = await import("@/tree/byok/resolve-user-api-key");

      const byokKey = await resolveUserApiKey(userId, "openrouter");
      const variants = await generateVariants({
        originalCaption: title!,
        locale: "en",
        byokOpenRouterKey: byokKey ?? undefined,
      });

      abExperimentId = await createExperiment({
        videoId: campaignId,
        tenantId: userId,
        variantACaption: variants.variantACaption,
        variantBCaption: variants.variantBCaption,
        offerId: offerId ?? undefined,
      });
    } catch (err) {
      logger.warn(
        "[createCampaign] AB variant generation failed — campaign continues with original title",
        {
          campaignId,
          error: toError(err).message,
        },
      );
    }

    try {
      await sendCampaignCreatedEvent({
        campaignId,
        userId,
        topic: topic || title!,
        audience: audience || "General",
        tier,
        abExperimentId,
      });
    } catch {
      // Inngest not configured — campaign still created
    }

    revalidatePath("/dashboard/campaigns");
    return { success: true, message: "Campaign created", campaignId };
  } catch (e) {
    return { success: false, message: `Error: ${toError(e).message}` };
  }
}

/**
 * Server Action: Fetch available affiliate programs for the current user.
 * Used by campaign-form.tsx dropdown.
 */
export async function getOffersForUser() {
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const tier = await resolveUserTier(user.id);
    const { getTopPrograms } = await import("@/land/affiliates");
    return getTopPrograms(5, tier);
  } catch {
    return [];
  }
}

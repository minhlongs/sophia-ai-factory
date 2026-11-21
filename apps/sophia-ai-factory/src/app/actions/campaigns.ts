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
  checkMonthlyCampaignLimit,
  insertCampaignRecord,
  linkAffiliateOffer,
} from "@/land/campaigns";
import { revalidatePath } from "next/cache";
import { tierGuard } from "@/land/tier-guard";
import { updateCampaignStatus } from "@/land/video/generation/generate-campaign-db";
import { toError } from "@/seed/utils/to-error";
import { logger } from "@/seed/utils/logger-utility";
import {
  extractCampaignFormData,
  validateCampaignFormData,
  tryCreateCampaignAbExperiment,
  tryDispatchCampaignCreatedEvent,
} from "./campaigns-helpers";
import { authorizeCampaignCreation, checkMultiChannelAccess } from "./campaigns-guard-helpers";

export async function createCampaign(formData: FormData) {
  const { offerId, templateId, platforms, rawData } = extractCampaignFormData(formData);
  const validation = validateCampaignFormData(rawData);
  if (!validation.success) {
    return { success: false, message: validation.error.message };
  }

  const { title, topic, audience } = validation.data;
  const authResult = await authorizeCampaignCreation();
  if ('error' in authResult) {
    return { success: false, message: authResult.error };
  }

  const { userId, orgId, d1db, tier } = authResult;
  if (platforms && platforms.length > 1) {
    const multiChannelAccess = await checkMultiChannelAccess(userId);
    if (!multiChannelAccess) {
      return {
        success: false,
        message: "Multi-channel distribution requires a PREMIUM subscription.",
        requiresUpgrade: true,
        requiredTier: "PREMIUM",
      };
    }
  }

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
    const insertResult = await insertCampaignRecord({
      campaignId,
      userId,
      orgId,
      title: title!,
      topic: topic || "",
      audience: audience || "",
      templateId,
    });

    if (!insertResult.success) {
      return { success: false, message: insertResult.error || "Failed to create campaign" };
    }

    if (offerId) {
      await linkAffiliateOffer(campaignId, userId, offerId);
    }

    const abExperimentId = await tryCreateCampaignAbExperiment({
      campaignId,
      userId,
      title: title!,
      offerId,
    });

    const dispatchResult = await tryDispatchCampaignCreatedEvent({
      campaignId,
      userId,
      topic: topic || title!,
      audience: audience || "General",
      tier,
      abExperimentId,
    });

    if (!dispatchResult.dispatched) {
      try {
        await updateCampaignStatus(campaignId, "failed", 0, {
          error_message: `Dispatch failed: ${dispatchResult.error}`,
        });
      } catch (statusErr) {
        logger.error(
          "[createCampaign] Failed to mark campaign failed after dispatch error",
          {
            campaignId,
            error: toError(statusErr).message,
          },
        );
      }

      revalidatePath("/dashboard/campaigns");
      return {
        success: false,
        error: "Failed to queue campaign execution / Không thể đưa chiến dịch vào hàng chờ xử lý",
        message: "Failed to queue campaign execution / Không thể đưa chiến dịch vào hàng chờ xử lý",
        campaignId,
      };
    }

    revalidatePath("/dashboard/campaigns");
    return { success: true, message: "Campaign created", campaignId };
  } catch (e) {
    return { success: false, message: `Error: ${toError(e).message}` };
  }
}

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
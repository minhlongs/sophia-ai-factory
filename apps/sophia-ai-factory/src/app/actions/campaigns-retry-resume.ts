"use server";

/**
 * Campaign Retry & Resume Actions
 *
 * Server actions for retrying and resuming failed campaigns.
 *
 * @module app/actions/campaigns-retry-resume
 */

import { createServerClient } from "@/seed/db/client";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { sendCampaignCreatedEvent } from "@/land/campaigns/create-campaign-core";
import { revalidatePath } from "next/cache";
import {
  loadFailedCampaignWithTier,
  resolveResumeStep,
} from "./campaigns-retry-resume-helpers";

/**
 * Retry a failed campaign from the beginning.
 */
export async function retryCampaign(campaignId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, message: "Unauthorized" };
    }

    const db = createServerClient();
    const loaded = await loadFailedCampaignWithTier(
      db,
      campaignId,
      currentUser.id,
      "retried",
    );
    if (!loaded.ok) {
      return { success: false, message: loaded.message };
    }

    const { campaign: c, tier } = loaded;

    const { error: updateError } = await db
      .from("campaigns")
      .update({
        status: "queued",
        progress: 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .eq("user_id", currentUser.id);

    if (updateError) {
      return { success: false, message: "Failed to reset campaign" };
    }

    await sendCampaignCreatedEvent({
      campaignId: c.id,
      userId: c.user_id,
      topic: c.topic || c.title,
      audience: c.audience || "General Audience",
      tier,
    });

    revalidatePath("/dashboard/campaigns");
    return { success: true, message: "Campaign retry initiated" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Resume a failed campaign from the last successful step.
 */
export async function resumeCampaign(campaignId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, message: "Unauthorized" };
    }

    const db = createServerClient();
    const loaded = await loadFailedCampaignWithTier(
      db,
      campaignId,
      currentUser.id,
      "resumed",
    );
    if (!loaded.ok) {
      return { success: false, message: loaded.message };
    }

    const { campaign: c, tier } = loaded;
    const { resumeStatus, resumeProgress, resumeFrom } = resolveResumeStep(c);

    const { error: updateError } = await db
      .from("campaigns")
      .update({
        status: resumeStatus,
        progress: resumeProgress,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId)
      .eq("user_id", currentUser.id);

    if (updateError) {
      return { success: false, message: "Failed to update campaign" };
    }

    await sendCampaignCreatedEvent({
      campaignId: c.id,
      userId: c.user_id,
      topic: c.topic || c.title,
      audience: c.audience || "General Audience",
      tier,
      resume: true,
      resumeFrom,
    });

    revalidatePath("/dashboard/campaigns");
    return {
      success: true,
      message: `Campaign resumed from ${resumeFrom} step`,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

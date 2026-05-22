"use server";

/**
 * Campaign Retry & Resume Actions
 *
 * Server actions for retrying and resuming failed campaigns.
 *
 * @module app/actions/campaigns-retry-resume
 */

import { getD1Client } from "@/seed/db/client";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { sendCampaignCreatedEvent } from "@/lib/campaigns/create-campaign-core";
import { revalidatePath } from "next/cache";
import { Tier } from "@/seed/types";

/** Map DB subscription_tier string to app Tier enum */
function mapDbTierToTier(dbTier: string | null | undefined): Tier {
  if (dbTier === 'premium' || dbTier === 'pro') return "PREMIUM";
  if (dbTier === 'enterprise') return "ENTERPRISE";
  if (dbTier === 'master') return "MASTER";
  return "BASIC";
}

/**
 * Retry a failed campaign from the beginning.
 */
export async function retryCampaign(campaignId: string) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, message: "Unauthorized" };
    }

    const db = await getD1Client();

    const { data: campaign, error: fetchError } = await db
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (fetchError || !campaign) {
      return { success: false, message: "Campaign not found" };
    }

    const c = campaign as { id: string; status: string; user_id: string; topic: string; title: string; audience: string };

    if (c.user_id !== currentUser.id) {
      return { success: false, message: "Unauthorized" };
    }

    if (c.status !== "failed") {
      return { success: false, message: "Only failed campaigns can be retried" };
    }

    const { data: profile } = await db
      .from("user_profiles")
      .select("subscription_tier")
      .eq("user_id", c.user_id)
      .single();

    const tier = mapDbTierToTier((profile as { subscription_tier?: string } | null)?.subscription_tier);

    const { error: updateError } = await db
      .from("campaigns")
      .update({ status: "queued", progress: 0, updated_at: new Date().toISOString() })
      .eq("id", campaignId);

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
      message: error instanceof Error ? error.message : "Unknown error"
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

    const db = await getD1Client();

    const { data: campaign, error: fetchError } = await db
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (fetchError || !campaign) {
      return { success: false, message: "Campaign not found" };
    }

    const c = campaign as {
      id: string; status: string; user_id: string; topic: string; title: string;
      audience: string; script: string | null; video_url: string | null;
    };

    if (c.user_id !== currentUser.id) {
      return { success: false, message: "Unauthorized" };
    }

    if (c.status !== "failed") {
      return { success: false, message: "Only failed campaigns can be resumed" };
    }

    const { data: profile } = await db
      .from("user_profiles")
      .select("subscription_tier")
      .eq("user_id", c.user_id)
      .single();

    const tier = mapDbTierToTier((profile as { subscription_tier?: string } | null)?.subscription_tier);

    const hasScript = !!c.script && c.script.length > 0;
    const hasVideo = !!c.video_url;

    let resumeStatus: "processing_script" | "processing_video";
    let resumeProgress: number;
    let resumeFrom: "script" | "tts" | "video" | "finalize";

    if (hasVideo) {
      resumeStatus = "processing_video"; resumeProgress = 90; resumeFrom = "finalize";
    } else if (hasScript) {
      resumeStatus = "processing_script"; resumeProgress = 45; resumeFrom = "tts";
    } else {
      resumeStatus = "processing_script"; resumeProgress = 10; resumeFrom = "script";
    }

    const { error: updateError } = await db
      .from("campaigns")
      .update({ status: resumeStatus, progress: resumeProgress, updated_at: new Date().toISOString() })
      .eq("id", campaignId);

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
    return { success: true, message: `Campaign resumed from ${resumeFrom} step` };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

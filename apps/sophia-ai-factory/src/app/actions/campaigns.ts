"use server";

import { getD1Client } from "@/lib/db/client";
import { inngest } from "@/lib/inngest/client";
import { createCampaignSchema } from "@/lib/campaigns/validation";
import { revalidatePath } from "next/cache";
import { Tier } from "@/types";
import { tierGuard } from "@/lib/tier-guard";

/** Map DB subscription_tier string to app Tier enum */
function mapDbTierToTier(dbTier: string | null | undefined): Tier {
  if (dbTier === 'premium' || dbTier === 'pro') return "PREMIUM";
  if (dbTier === 'enterprise') return "ENTERPRISE";
  if (dbTier === 'master') return "MASTER";
  return "BASIC";
}

export async function createCampaign(formData: FormData) {
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

  // Get current user from D1 auth session
  const db = await getD1Client();

  // For development: fallback to first user if no session
  let userId: string | undefined;

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    const { data: firstUser } = await db.from('users').select('id').limit(1).single();
    userId = (firstUser as { id: string } | null)?.id;
    if (!userId) {
      return { success: false, message: "No authenticated user found. Please sign up/in." };
    }
  } else {
    return { success: false, message: "Unauthorized" };
  }

  // TIER CHECK: Multi-channel access
  if (platforms && platforms.length > 1) {
    const multiChannelAccess = await tierGuard.checkMultiChannelAccess(userId);
    if (!multiChannelAccess) {
      return {
        success: false,
        message: "Multi-channel distribution requires a PREMIUM subscription.",
        requiresUpgrade: true,
        requiredTier: "PREMIUM"
      };
    }
  }

  // Fetch user profile for tier
  const { data: profile } = await db
    .from("user_profiles")
    .select("subscription_tier")
    .eq("user_id", userId)
    .single();

  const tier = mapDbTierToTier((profile as { subscription_tier?: string } | null)?.subscription_tier);

  try {
    // 1. Create Campaign Record
    const { data: campaign, error } = await db
      .from("campaigns")
      .insert({
        user_id: userId,
        title: title!,
        topic: topic || "",
        audience: audience || "",
        status: "queued",
        progress: 0,
        template_id: templateId
      })
      .select()
      .single();

    if (error) {
      return { success: false, message: "Failed to create campaign record" };
    }

    const campaignData = campaign as { id: string };

    // 2. Trigger Inngest Event
    await inngest.send({
      name: "campaign.created",
      data: {
        campaignId: campaignData.id,
        userId,
        topic: topic || title!,
        audience: audience || "General",
        tier
      }
    });

    revalidatePath("/dashboard/campaigns");
    return { success: true, message: "Campaign created", campaignId: campaignData.id };

  } catch {
    return { success: false, message: "Internal server error" };
  }
}

/**
 * Retry a failed campaign from the beginning
 */
export async function retryCampaign(campaignId: string) {
  try {
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

    if (c.status !== "failed") {
      return { success: false, message: "Only failed campaigns can be retried" };
    }

    // Get user tier
    const { data: profile } = await db
      .from("user_profiles")
      .select("subscription_tier")
      .eq("user_id", c.user_id)
      .single();

    const tier = mapDbTierToTier((profile as { subscription_tier?: string } | null)?.subscription_tier);

    // Reset campaign state
    const { error: updateError } = await db
      .from("campaigns")
      .update({
        status: "queued",
        progress: 0,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    if (updateError) {
      return { success: false, message: "Failed to reset campaign" };
    }

    // Trigger Inngest workflow
    await inngest.send({
      name: "campaign.created",
      data: {
        campaignId: c.id,
        userId: c.user_id,
        topic: c.topic || c.title,
        audience: c.audience || "General Audience",
        tier
      }
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
 * Resume a failed campaign from the last successful step
 */
export async function resumeCampaign(campaignId: string) {
  try {
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
      audience: string; script_content: Record<string, unknown> | null;
      audio_url: string | null; video_url: string | null;
    };

    if (c.status !== "failed") {
      return { success: false, message: "Only failed campaigns can be resumed" };
    }

    // Get user tier
    const { data: profile } = await db
      .from("user_profiles")
      .select("subscription_tier")
      .eq("user_id", c.user_id)
      .single();

    const tier = mapDbTierToTier((profile as { subscription_tier?: string } | null)?.subscription_tier);

    // Determine resume point
    const hasScript = c.script_content && Object.keys(c.script_content).length > 0;
    const hasAudio = !!c.audio_url;
    const hasVideo = !!c.video_url;

    let resumeStatus: "processing_script" | "processing_video";
    let resumeProgress: number;
    let resumeFrom: "script" | "tts" | "video" | "finalize";

    if (hasVideo) {
      resumeStatus = "processing_video"; resumeProgress = 90; resumeFrom = "finalize";
    } else if (hasAudio) {
      resumeStatus = "processing_video"; resumeProgress = 70; resumeFrom = "video";
    } else if (hasScript) {
      resumeStatus = "processing_script"; resumeProgress = 45; resumeFrom = "tts";
    } else {
      resumeStatus = "processing_script"; resumeProgress = 10; resumeFrom = "script";
    }

    const { error: updateError } = await db
      .from("campaigns")
      .update({
        status: resumeStatus,
        progress: resumeProgress,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    if (updateError) {
      return { success: false, message: "Failed to update campaign" };
    }

    await inngest.send({
      name: "campaign.created",
      data: {
        campaignId: c.id,
        userId: c.user_id,
        topic: c.topic || c.title,
        audience: c.audience || "General Audience",
        tier,
        resume: true,
        resumeFrom
      }
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

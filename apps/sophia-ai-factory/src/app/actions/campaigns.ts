"use server";

import { getD1Client } from "@/lib/db/client";
import { sendCampaignCreatedEvent } from "@/lib/campaigns/create-campaign-core";
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

  // Get current user from Better Auth session
  let userId: string | undefined;
  try {
    const { getCurrentUser } = await import("@/lib/better-auth-session");
    const user = await getCurrentUser();
    if (user) userId = user.id;
  } catch { /* Auth session check failed */ }

  if (!userId) {
    return { success: false, message: "Vui lòng đăng nhập để tạo chiến dịch." };
  }

  const db = await getD1Client();

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

  // Fetch tier from subscriptions via org membership
  const { getUserTier } = await import("@/lib/db/get-user-tier");
  const tier = await getUserTier(userId);

  // TIER CHECK: Monthly campaign limit
  const { UNIFIED_TIERS } = await import("@/config/tiers");
  const monthLimit = UNIFIED_TIERS[tier].campaignsPerMonth;

  if (monthLimit < 999) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: countData } = await db
      .from("campaigns")
      .select("id")
      .eq("user_id", userId)
      .gte("created_at", startOfMonth.toISOString());

    const currentCount = (countData as { id: string }[] | null)?.length ?? 0;
    if (currentCount >= monthLimit) {
      return {
        success: false,
        message: `Monthly campaign limit reached (${monthLimit}). Upgrade your plan for more.`,
        requiresUpgrade: true,
      };
    }
  }

  try {
    // 1. Create Campaign Record (generate ID upfront — D1 doesn't support RETURNING)
    const campaignId = crypto.randomUUID();
    const { error } = await db
      .from("campaigns")
      .insert({
        id: campaignId,
        user_id: userId,
        title: title!,
        topic: topic || "",
        audience: audience || "",
        status: "queued",
        progress: 0,
        template_id: templateId
      });

    if (error) {
      return { success: false, message: `Failed to create campaign: ${error.message || JSON.stringify(error)}` };
    }

    const campaignData = { id: campaignId };

    // 2. Trigger Inngest Event (optional — may not be configured on CF Workers)
    try {
      await sendCampaignCreatedEvent({
        campaignId: campaignData.id,
        userId,
        topic: topic || title!,
        audience: audience || "General",
        tier,
      });
    } catch {
      // Inngest not configured — campaign still created, processing will be manual
    }

    revalidatePath("/dashboard/campaigns");
    return { success: true, message: "Campaign created", campaignId: campaignData.id };

  } catch (e) {
    return { success: false, message: `Error: ${(e as Error).message}` };
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
        updated_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    if (updateError) {
      return { success: false, message: "Failed to reset campaign" };
    }

    // Trigger Inngest workflow
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
      audience: string; script: string | null; video_url: string | null;
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

    // Determine resume point based on existing data
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
      .update({
        status: resumeStatus,
        progress: resumeProgress,
        updated_at: new Date().toISOString()
      })
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

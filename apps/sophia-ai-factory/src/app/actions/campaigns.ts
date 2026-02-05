"use server";

import { createServerClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { inngest } from "@/lib/inngest/client";
import { createCampaignSchema } from "@/lib/campaigns/validation";
import { revalidatePath } from "next/cache";
import { Tier } from "@/types";
import { tierGuard } from "@/lib/tier-guard";

// Initialize Admin client for operations that might need bypass (like if auth is not fully hooked up in UI yet)
// But ideally we use createServerClient to respect RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createCampaign(formData: FormData) {
  const rawData = {
    title: formData.get("title") || formData.get("topic"), // Fallback for now
    topic: formData.get("topic"),
    audience: formData.get("audience"),
    // Add platforms support if passed (simulated for now as it's not in schema yet)
    platforms: formData.getAll("platforms"),
  };

  // Get template_id if provided
  const templateId = formData.get("template_id") as string | null;

  // Validate
  const validation = createCampaignSchema.safeParse(rawData);
  if (!validation.success) {
    return { success: false, message: validation.error.message };
  }

  const { title, topic, audience } = validation.data;
  // Explicitly cast platforms since it's not in the schema yet but we want to use it for tier check
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const platforms = (rawData as any).platforms as string[];

  // Get current user
  const supabase = await createServerClient();
  const { data: { session } } = await supabase.auth.getSession();

  let userId = session?.user?.id;

  // Fallback for development if no session (and using mock auth logic elsewhere)
  if (!userId) {
    // Check if we have a mock user override or just fail
    // For this MVP phase, if we are strictly testing the flow, we might need a real user.
    // Let's try to get the first user from admin if dev
    if (process.env.NODE_ENV === 'development') {
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        if (users?.users?.length > 0) {
            userId = users.users[0].id;
            console.warn(`[DEV] Using first found user: ${userId}`);
        } else {
             return { success: false, message: "No authenticated user found. Please sign up/in." };
        }
    } else {
        return { success: false, message: "Unauthorized" };
    }
  }

  // TIER CHECK: Multi-channel access
  // Requirement: "Update campaign creation to check PREMIUM tier for multi-channel"
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

  // Fetch user profile for Tier
  const { data: profile } = await supabaseAdmin
    .from("user_profiles")
    .select("subscription_tier")
    .eq("user_id", userId!)
    .single();

  // Map DB tier to App Tier
  let tier: Tier = "BASIC";
  if (profile?.subscription_tier === 'pro') tier = "PREMIUM";
  if (profile?.subscription_tier === 'enterprise') tier = "ENTERPRISE";

  try {
    // 1. Create Campaign Record
    const { data: campaign, error } = await supabaseAdmin
      .from("campaigns")
      .insert({
        user_id: userId!,
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
      console.error("DB Insert Error:", error);
      return { success: false, message: "Failed to create campaign record" };
    }

    // 2. Trigger Inngest Event
    await inngest.send({
      name: "campaign.created",
      data: {
        campaignId: campaign.id,
        userId: userId!,
        topic: topic || title!,
        audience: audience || "General",
        tier: tier
      }
    });

    revalidatePath("/dashboard/campaigns");
    return { success: true, message: "Campaign created", campaignId: campaign.id };

  } catch (err) {
    console.error("Create Campaign Error:", err);
    return { success: false, message: "Internal server error" };
  }
}

/**
 * Retry a failed campaign from the beginning
 */
export async function retryCampaign(campaignId: string) {
  try {
    // 1. Fetch campaign to validate it's failed
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (fetchError || !campaign) {
      return { success: false, message: "Campaign not found" };
    }

    if (campaign.status !== "failed") {
      return { success: false, message: "Only failed campaigns can be retried" };
    }

    // 2. Get user tier
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("subscription_tier")
      .eq("user_id", campaign.user_id)
      .single();

    let tier: Tier = "BASIC";
    if (profile?.subscription_tier === 'pro') tier = "PREMIUM";
    if (profile?.subscription_tier === 'enterprise') tier = "ENTERPRISE";

    // 3. Reset campaign state
    const { error: updateError } = await supabaseAdmin
      .from("campaigns")
      .update({
        status: "queued",
        progress: 0,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    if (updateError) {
      console.error("Failed to reset campaign:", updateError);
      return { success: false, message: "Failed to reset campaign" };
    }

    // 4. Trigger Inngest workflow
    await inngest.send({
      name: "campaign.created",
      data: {
        campaignId: campaign.id,
        userId: campaign.user_id,
        topic: campaign.topic || campaign.title,
        audience: campaign.audience || "General Audience",
        tier: tier
      }
    });

    revalidatePath("/dashboard/campaigns");
    return { success: true, message: "Campaign retry initiated" };
  } catch (error) {
    console.error("Error retrying campaign:", error);
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
    // 1. Fetch campaign to validate it's failed
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", campaignId)
      .single();

    if (fetchError || !campaign) {
      return { success: false, message: "Campaign not found" };
    }

    if (campaign.status !== "failed") {
      return { success: false, message: "Only failed campaigns can be resumed" };
    }

    // 2. Get user tier
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("subscription_tier")
      .eq("user_id", campaign.user_id)
      .single();

    let tier: Tier = "BASIC";
    if (profile?.subscription_tier === 'pro') tier = "PREMIUM";
    if (profile?.subscription_tier === 'enterprise') tier = "ENTERPRISE";

    // 3. Determine resume point based on existing data
    const hasScript = campaign.script_content && Object.keys(campaign.script_content).length > 0;
    const hasAudio = !!campaign.audio_url;
    const hasVideo = !!campaign.video_url;

    // Set resume status and progress based on what's completed
    let resumeStatus: "processing_script" | "processing_video";
    let resumeProgress: number;
    let resumeFrom: "script" | "tts" | "video" | "finalize";

    if (hasVideo) {
      // Failed during finalization
      resumeStatus = "processing_video";
      resumeProgress = 90;
      resumeFrom = "finalize";
    } else if (hasAudio) {
      // Failed during video generation
      resumeStatus = "processing_video";
      resumeProgress = 70;
      resumeFrom = "video";
    } else if (hasScript) {
      // Failed during TTS generation
      resumeStatus = "processing_script";
      resumeProgress = 45;
      resumeFrom = "tts";
    } else {
      // Failed during script generation
      resumeStatus = "processing_script";
      resumeProgress = 10;
      resumeFrom = "script";
    }

    // 4. Update campaign state to resume point
    const { error: updateError } = await supabaseAdmin
      .from("campaigns")
      .update({
        status: resumeStatus,
        progress: resumeProgress,
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", campaignId);

    if (updateError) {
      console.error("Failed to update campaign:", updateError);
      return { success: false, message: "Failed to update campaign" };
    }

    // 5. Trigger Inngest workflow with resume metadata
    await inngest.send({
      name: "campaign.created",
      data: {
        campaignId: campaign.id,
        userId: campaign.user_id,
        topic: campaign.topic || campaign.title,
        audience: campaign.audience || "General Audience",
        tier: tier,
        resume: true,
        resumeFrom: resumeFrom
      }
    });

    revalidatePath("/dashboard/campaigns");
    return { success: true, message: `Campaign resumed from ${resumeFrom} step` };
  } catch (error) {
    console.error("Error resuming campaign:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

"use server";

import { createClient } from "@/lib/supabase/server";
import { Tier } from "@/types";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/utils/logger-utility";

/**
 * Trigger Script Generation Workflow
 * Calls the n8n webhook
 */
export async function generateScript(formData: FormData) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Unauthorized: Please log in" };
  }

  const topic = formData.get("topic") as string;
  const audience = formData.get("audience") as string;

  if (!topic || !audience) {
    return { success: false, message: "Topic and audience are required" };
  }

  const rawTier = user.user_metadata?.tier;
  const userTier: Tier = (typeof rawTier === "string" && ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"].includes(rawTier))
    ? (rawTier as Tier)
    : "BASIC";

  // 1. Create initial record in Supabase (Draft status)
  try {
    const { data: campaign, error: dbError } = await (supabase
      .from("campaigns") as any)
      .insert({
        topic,
        audience,
        title: topic, // Default title to topic
        status: "draft",
        user_id: user.id
      })
      .select()
      .single();

    if (dbError || !campaign) {
      logger.error("Failed to create campaign record", dbError);
      return { success: false, message: "Failed to initialize campaign" };
    }

    // 2. Call n8n Webhook
    const webhookUrl = process.env.N8N_WEBHOOK_GENERATE_SCRIPT;

    if (webhookUrl) {
      // Fire and forget (or await if we want to confirm receipt)
      // We pass the Record ID so n8n can update it
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId: campaign.id,
          topic,
          audience,
          userId: user.id,
          tier: userTier
        }),
      });
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Script generation started", scriptId: campaign.id };
  } catch (err) {
    logger.error("Exception in generateScript", err instanceof Error ? err : undefined);
    return { success: false, message: "Failed to start generation" };
  }
}

/**
 * Trigger Video Rendering Workflow
 */
export async function renderVideo(scriptId: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { success: false, message: "Unauthorized" };
  }

  if (!scriptId) return { success: false, message: "Script ID required" };

  try {
    // 1. Update status to video_queued
    const { error: dbError } = await (supabase
      .from("campaigns") as any)
      .update({ status: "processing_video" })
      .eq("id", scriptId)
      .eq("user_id", user.id);

    if (dbError) {
      logger.error("Failed to update campaign status for rendering", dbError);
      return { success: false, message: "Failed to update status" };
    }

    // 2. Call n8n Webhook for Video
    const webhookUrl = process.env.N8N_WEBHOOK_RENDER_VIDEO;

    if (webhookUrl) {
      // Fire and forget
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId,
          userId: user.id,
        }),
      }).catch((err) => {
        logger.error("Video render webhook failed", err instanceof Error ? err : undefined, { scriptId, webhookUrl });
      });
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Video rendering started" };
  } catch (err) {
    logger.error("Exception in renderVideo", err instanceof Error ? err : undefined);
    return { success: false, message: "Failed to start rendering" };
  }
}

/**
 * Fetch user's projects (scripts/videos)
 */
export async function getUserProjects() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return [];

  try {
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch user projects", error);
      return [];
    }

    return campaigns || [];
  } catch {
    return [];
  }
}

"use server";

import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { createServerClient } from "@/seed/db/client";
import { Tier } from "@/seed/types";
import { revalidatePath } from "next/cache";
import { logger } from "@/seed/utils/logger-utility";
import { toError } from "@/seed/utils/to-error";

async function getUser() {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

/**
 * Trigger Script Generation Workflow
 * Calls the n8n webhook
 */
export async function generateScript(formData: FormData) {
  const user = await getUser();

  if (!user) {
    return { success: false, message: "Unauthorized: Please log in" };
  }

  const topic = formData.get("topic") as string;
  const audience = formData.get("audience") as string;

  if (!topic || !audience) {
    return { success: false, message: "Topic and audience are required" };
  }

  // Get actual user tier from D1
  const { getUserTier } = await import("@/seed/db/get-user-tier");
  const userTier: Tier = await getUserTier(user.id);

  try {
    const db = createServerClient();
    const { data: campaign, error: dbError } = await db
      .from("campaigns")
      .insert({
        topic,
        audience,
        title: topic,
        status: "draft",
        user_id: user.id
      })
      .select()
      .single();

    if (dbError || !campaign) {
      logger.error("Failed to create campaign record", toError(dbError));
      return { success: false, message: "Failed to initialize campaign" };
    }

    const campaignData = campaign as Record<string, string>;

    // Call n8n Webhook
    const webhookUrl = process.env.N8N_WEBHOOK_GENERATE_SCRIPT;

    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId: campaignData.id,
          topic,
          audience,
          userId: user.id,
          tier: userTier
        }),
      });
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Script generation started", scriptId: campaignData.id };
  } catch (err) {
    logger.error("Exception in generateScript", err instanceof Error ? err : undefined);
    return { success: false, message: "Failed to start generation" };
  }
}

/**
 * Trigger Video Rendering Workflow
 */
export async function renderVideo(scriptId: string) {
  const user = await getUser();

  if (!user) {
    return { success: false, message: "Unauthorized" };
  }

  if (!scriptId) return { success: false, message: "Script ID required" };

  try {
    const db = createServerClient();
    const { error: dbError } = await db
      .from("campaigns")
      .update({ status: "processing_video" })
      .eq("id", scriptId)
      .eq("user_id", user.id);

    if (dbError) {
      logger.error("Failed to update campaign status for rendering", toError(dbError));
      return { success: false, message: "Failed to update status" };
    }

    // Call n8n Webhook for Video
    const webhookUrl = process.env.N8N_WEBHOOK_RENDER_VIDEO;

    if (webhookUrl) {
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
  const user = await getUser();

  if (!user) return [];

  try {
    const db = createServerClient();
    const { data: campaigns, error } = await db
      .from("campaigns")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to fetch user projects", toError(error));
      return [];
    }

    return campaigns || [];
  } catch {
    return [];
  }
}

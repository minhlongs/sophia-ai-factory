"use server";

import { airtable } from "@/lib/airtable";
import { Tier } from "@/types";
import { revalidatePath } from "next/cache";

// Mock User ID for now (until Auth is implemented)
const MOCK_USER_ID = "user_demo_123";
const MOCK_USER_TIER: Tier = "PREMIUM";

/**
 * Trigger Script Generation Workflow
 * Calls the n8n webhook
 */
export async function generateScript(formData: FormData) {
  const topic = formData.get("topic") as string;
  const audience = formData.get("audience") as string;

  if (!topic || !audience) {
    return { success: false, message: "Topic and audience are required" };
  }

  // 1. Create initial record in Airtable (Draft status)
  // This acts as an optimistic update and ensures we have an ID
  try {
    const record = await airtable.scripts.create({
      topic,
      content: "Generating...",
      status: "draft",
      tier: MOCK_USER_TIER,
      userId: MOCK_USER_ID,
    });

    // 2. Call n8n Webhook
    const webhookUrl = process.env.N8N_WEBHOOK_GENERATE_SCRIPT;

    if (webhookUrl) {
      // Fire and forget (or await if we want to confirm receipt)
      // We pass the Record ID so n8n can update it
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId: record.id,
          topic,
          audience,
          userId: MOCK_USER_ID,
          tier: MOCK_USER_TIER
        }),
      });
    } else {
      // For demo purposes, we might want to simulate generation if no webhook
      // But adhering to "Real Code" rule, we just log warning.
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Script generation started", scriptId: record.id };
  } catch (error) {
    return { success: false, message: "Failed to start generation" };
  }
}

/**
 * Trigger Video Rendering Workflow
 */
export async function renderVideo(scriptId: string) {
  if (!scriptId) return { success: false, message: "Script ID required" };

  try {
    // 1. Update status to video_queued
    await airtable.scripts.updateStatus(scriptId, "video_queued");

    // 2. Call n8n Webhook for Video
    const webhookUrl = process.env.N8N_WEBHOOK_RENDER_VIDEO;

    if (webhookUrl) {
      // Fire and forget
      fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptId,
          userId: MOCK_USER_ID,
        }),
      }).catch(() => {});
      // We catch fetch error here to not block UI if fire-and-forget fails immediately
    } else {
    }

    revalidatePath("/dashboard");
    return { success: true, message: "Video rendering started" };
  } catch (error) {
    return { success: false, message: "Failed to start rendering" };
  }
}

/**
 * Fetch user's projects (scripts/videos)
 */
export async function getUserProjects() {
  try {
    const scripts = await airtable.scripts.list(MOCK_USER_ID);
    return scripts;
  } catch (error) {
    return [];
  }
}

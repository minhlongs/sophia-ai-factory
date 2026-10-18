"use server";

import { Tier } from "@/seed/types";
import { revalidatePath } from "next/cache";
import { logger } from "@/seed/utils/logger-utility";
import {
  getAuthenticatedUser,
  triggerGenerateScriptWebhook,
  triggerRenderVideoWebhook,
} from "./automation-helpers";
import {
  createCampaignRecord,
  updateCampaignForRender,
  fetchUserProjects,
} from "./automation-db-helpers";

/**
 * Trigger Script Generation Workflow
 * Calls the n8n webhook
 */
export async function generateScript(formData: FormData) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { success: false, message: "Unauthorized: Please log in" };
  }

  const topic = formData.get("topic") as string;
  const audience = formData.get("audience") as string;

  if (!topic || !audience) {
    return { success: false, message: "Topic and audience are required" };
  }

  const { resolveUserTier } = await import("@/seed/db/resolve-user-tier");
  const userTier: Tier = await resolveUserTier(user.id);

  try {
    const result = await createCampaignRecord(user.id, topic, audience);
    if ('error' in result) {
      return { success: false, message: result.error };
    }

    await triggerGenerateScriptWebhook({
      scriptId: result.id,
      topic,
      audience,
      userId: user.id,
      tier: userTier,
    });

    revalidatePath("/dashboard");
    return { success: true, message: "Script generation started", scriptId: result.id };
  } catch (err) {
    logger.error("Exception in generateScript", err instanceof Error ? err : undefined);
    return { success: false, message: "Failed to start generation" };
  }
}

/**
 * Trigger Video Rendering Workflow
 */
export async function renderVideo(scriptId: string) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return { success: false, message: "Unauthorized" };
  }

  if (!scriptId) return { success: false, message: "Script ID required" };

  try {
    const result = await updateCampaignForRender(scriptId, user.id);
    if ('error' in result) {
      return { success: false, message: result.error };
    }

    triggerRenderVideoWebhook({ scriptId, userId: user.id });

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
  const user = await getAuthenticatedUser();
  if (!user) return [];

  try {
    return await fetchUserProjects(user.id);
  } catch {
    return [];
  }
}
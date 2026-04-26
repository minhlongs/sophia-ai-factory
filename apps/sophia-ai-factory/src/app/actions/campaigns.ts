"use server";

import { getD1Client } from "@/lib/db/client";
import { sendCampaignCreatedEvent } from "@/lib/campaigns/create-campaign-core";
import { createCampaignSchema } from "@/lib/campaigns/validation";
import { revalidatePath } from "next/cache";
import { tierGuard } from "@/lib/tier-guard";
import { toError } from "@/lib/utils/to-error";

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

    try {
      await sendCampaignCreatedEvent({
        campaignId,
        userId,
        topic: topic || title!,
        audience: audience || "General",
        tier,
      });
    } catch {
      // Inngest not configured — campaign still created
    }

    revalidatePath("/dashboard/campaigns");
    return { success: true, message: "Campaign created", campaignId };

  } catch (e) {
    return { success: false, message: `Error: ${toError(e).message}` };
  }
}

"use server";

import { getD1Client } from "@/seed/db/client";
import { sendCampaignCreatedEvent } from "@/land/campaigns/create-campaign-core";
import { createCampaignSchema } from "@/land/campaigns/validation";
import { revalidatePath } from "next/cache";
import { tierGuard } from "@/land/tier-guard";
import { toError } from "@/seed/utils/to-error";
import { getProgramById } from "@/land/affiliates";
import { generateShortCode } from "@/land/affiliate-shortlink/short-code-generator";
import { logger } from "@/seed/utils/logger-utility";

export async function createCampaign(formData: FormData) {
  const offerId = formData.get("offer_id") as string | null;
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
    const { getCurrentUser } = await import("@/seed/auth/better-auth-session");
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

  const { getUserTier } = await import("@/seed/db/get-user-tier");
  const tier = await getUserTier(userId);

  // TIER CHECK: Monthly campaign limit
  const { UNIFIED_TIERS } = await import("@/seed/config/tiers");
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

    // Insert affiliate offer selection if user picked one
    if (offerId) {
      const program = getProgramById(offerId);
      if (program) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const shortCode = generateShortCode();
          const { error: offerError } = await db.from('affiliate_offers_selected').insert({
            campaign_id: campaignId,
            user_id: userId,
            offer_id: program.id,
            offer_name: program.name,
            affiliate_link: program.link,
            short_code: shortCode,
            network: 'clickbank',
            // TODO(M5): source actual commission % from network API — program.epc is EPC not commission rate
            commission_rate: null,
          });
          if (!offerError) break;
          if (attempt === 2) {
            logger.warn('affiliate_offer_insert_failed', { campaignId, offerId });
          }
        }
      }
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

/**
 * Server Action: Fetch available affiliate programs for the current user.
 * Used by campaign-form.tsx dropdown.
 */
export async function getOffersForUser() {
  try {
    const { getCurrentUser } = await import("@/seed/auth/better-auth-session");
    const user = await getCurrentUser();
    if (!user) return [];

    const { getUserTier } = await import("@/seed/db/get-user-tier");
    const tier = await getUserTier(user.id);

    const { getTopPrograms } = await import("@/land/affiliates");
    return getTopPrograms(5, tier);
  } catch {
    return [];
  }
}

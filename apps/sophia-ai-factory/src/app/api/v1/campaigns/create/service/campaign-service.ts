/**
 * Campaign Creation Quota & Ingestion Service
 *
 * Layer: app/api/v1/campaigns/create/service
 */

import { createServerClient } from "@/seed/db/client";
import { UNIFIED_TIERS } from "@/seed/config/tiers/unified-limits";
import { sendCampaignCreatedEvent } from "@/land/campaigns/create-campaign-core";
import { toError } from "@/seed/utils/to-error";
import type { Logger } from "@/seed/utils/logger-utility";

export interface CheckQuotaResult {
  allowed: boolean;
  monthLimit: number;
  currentCount: number;
  orgId?: string | null;
}

export async function checkCampaignCreationQuota(
  userId: string,
  log: Logger
): Promise<CheckQuotaResult> {
  const { resolveUserTier } = await import("@/seed/db/resolve-user-tier");
  const tier = await resolveUserTier(userId);

  const { getOrgIdForUser } = await import("@/tree/quota/org-quota-checker");
  const orgId = await getOrgIdForUser(userId);
  const useOrgQuota = process.env.ENABLE_ORG_QUOTAS === "1" && orgId !== null;

  let monthLimit: number;
  let currentCount: number;

  if (useOrgQuota) {
    const { checkCampaignQuota } = await import("@/tree/quota/org-quota-checker");
    const result = await checkCampaignQuota(userId, orgId, tier);
    monthLimit = result.limit;
    currentCount = result.current;
  } else {
    monthLimit = UNIFIED_TIERS[tier].campaignsPerMonth;
    if (monthLimit < 999) {
      const db = createServerClient();
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const { data } = await db
        .from("campaigns")
        .select("id")
        .eq("user_id", userId)
        .gte("created_at", startOfMonth.toISOString());
      currentCount = (data as { id: string }[] | null)?.length ?? 0;
    } else {
      currentCount = 0;
    }
  }

  if (monthLimit < 999 && currentCount >= monthLimit) {
    log.warn("RaaS campaign create: monthly limit reached", {
      userId,
      orgId: orgId ?? undefined,
      currentCount,
      monthLimit,
    });
    return { allowed: false, monthLimit, currentCount, orgId };
  }

  return { allowed: true, monthLimit, currentCount, orgId };
}

export interface IngestCampaignOptions {
  userId: string;
  title?: string;
  script: string;
  log: Logger;
}

export type IngestCampaignResult =
  | { success: true; campaignId: string; status: "queued" | "saved"; message?: string }
  | { success: false; status: 500; error: string };

export async function ingestCampaignRecord({
  userId,
  title,
  script,
  log,
}: IngestCampaignOptions): Promise<IngestCampaignResult> {
  const db = createServerClient();
  const { data: rawCampaign, error: insertError } = await db
    .from("campaigns")
    .insert({
      user_id: userId,
      title: title ?? "Untitled Campaign",
      topic: null,
      audience: null,
      status: "queued",
      script_content: { text: script },
    })
    .select("id")
    .single();

  const campaign = rawCampaign as { id: string } | null;

  if (insertError || !campaign) {
    log.error("RaaS campaign create: DB insert failed", insertError ? toError(insertError) : undefined);
    return { success: false, status: 500, error: "Failed to create campaign record" };
  }

  const inngestConfigured = !!(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY);

  if (inngestConfigured) {
    await sendCampaignCreatedEvent({
      campaignId: campaign.id,
      userId,
      topic: title ?? "RaaS Campaign",
      audience: "general",
      tier: "BASIC",
    });
    log.info("RaaS campaign create: queued successfully", { campaignId: campaign.id, userId });
    return { success: true, campaignId: campaign.id, status: "queued" };
  }

  log.warn("RaaS campaign create: Inngest not configured, campaign saved but not queued", {
    campaignId: campaign.id,
  });
  return {
    success: true,
    campaignId: campaign.id,
    status: "saved",
    message: "Background jobs not configured — campaign saved but not queued",
  };
}

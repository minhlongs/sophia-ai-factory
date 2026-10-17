/**
 * Campaign Retry & Resume Internal Helpers
 *
 * Shared DB lookup, validation, and state calculation helpers for
 * campaign retry and resume server actions.
 *
 * @module app/actions/campaigns-retry-resume-helpers
 */

import { createServerClient } from "@/seed/db/client";
import { Tier } from "@/seed/types";

export interface RetryResumeCampaignRow {
  id: string;
  status: string;
  user_id: string;
  topic: string;
  title: string;
  audience: string;
  script: string | null;
  video_url: string | null;
}

export interface ResumeStepTarget {
  resumeStatus: "processing_script" | "processing_video";
  resumeProgress: number;
  resumeFrom: "script" | "tts" | "video" | "finalize";
}

/** Map DB subscription_tier string to app Tier enum */
export function mapDbTierToTier(dbTier: string | null | undefined): Tier {
  if (dbTier === "premium" || dbTier === "pro") return "PREMIUM";
  if (dbTier === "enterprise") return "ENTERPRISE";
  if (dbTier === "master") return "MASTER";
  return "BASIC";
}

/** Compute resume status, progress, and step from campaign artifacts */
export function resolveResumeStep(c: RetryResumeCampaignRow): ResumeStepTarget {
  const hasScript = !!c.script && c.script.length > 0;
  const hasVideo = !!c.video_url;

  if (hasVideo) {
    return {
      resumeStatus: "processing_video",
      resumeProgress: 90,
      resumeFrom: "finalize",
    };
  }
  if (hasScript) {
    return {
      resumeStatus: "processing_script",
      resumeProgress: 45,
      resumeFrom: "tts",
    };
  }
  return {
    resumeStatus: "processing_script",
    resumeProgress: 10,
    resumeFrom: "script",
  };
}

/** Load campaign and verify ownership + failed status */
export async function loadFailedCampaignWithTier(
  db: ReturnType<typeof createServerClient>,
  campaignId: string,
  userId: string,
  actionVerb: "retried" | "resumed",
): Promise<
  | { ok: true; campaign: RetryResumeCampaignRow; tier: Tier }
  | { ok: false; message: string }
> {
  const { data: campaign, error: fetchError } = await db
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (fetchError || !campaign) {
    return { ok: false, message: "Campaign not found" };
  }

  const c = campaign as unknown as RetryResumeCampaignRow;

  if (c.user_id !== userId) {
    return { ok: false, message: "Unauthorized" };
  }

  if (c.status !== "failed") {
    return { ok: false, message: `Only failed campaigns can be ${actionVerb}` };
  }

  const { data: profile } = await db
    .from("user_profiles")
    .select("subscription_tier")
    .eq("user_id", c.user_id)
    .single();

  const tier = mapDbTierToTier(
    (profile as { subscription_tier?: string } | null)?.subscription_tier,
  );

  return { ok: true, campaign: c, tier };
}

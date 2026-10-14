/**
 * Campaign Server Action Helpers
 *
 * Non-action helpers for AB experiment creation and Inngest event dispatch.
 * Separated from `campaigns.ts` to keep Server Action controller concise.
 */

import {
  createCampaignSchema,
  sendCampaignCreatedEvent,
} from "@/land/campaigns";
import type { Tier } from "@/seed/types";
import { toError } from "@/seed/utils/to-error";
import { logger } from "@/seed/utils/logger-utility";

export interface ParsedCampaignInput {
  offerId: string | null;
  templateId: string | null;
  platforms: string[];
  rawData: {
    title: FormDataEntryValue | null;
    topic: FormDataEntryValue | null;
    audience: FormDataEntryValue | null;
    platforms: FormDataEntryValue[];
  };
}

export function extractCampaignFormData(formData: FormData): ParsedCampaignInput {
  const offerId = formData.get("offer_id") as string | null;
  const templateId = formData.get("template_id") as string | null;
  const rawData = {
    title: formData.get("title") || formData.get("topic"),
    topic: formData.get("topic"),
    audience: formData.get("audience"),
    platforms: formData.getAll("platforms"),
  };
  return {
    offerId,
    templateId,
    platforms: rawData.platforms as string[],
    rawData,
  };
}

export function validateCampaignFormData(rawData: ParsedCampaignInput["rawData"]) {
  return createCampaignSchema.safeParse(rawData);
}

/**
 * Best-effort A/B variant generation — failure does not block campaign creation.
 */
export async function tryCreateCampaignAbExperiment(params: {
  campaignId: string;
  userId: string;
  title: string;
  offerId: string | null;
}): Promise<string | undefined> {
  const { campaignId, userId, title, offerId } = params;
  try {
    const { generateVariants } = await import("@/forest/ab/variant-generator");
    const { createExperiment } = await import("@/forest/ab/experiment-store");
    const { resolveUserApiKey } = await import("@/tree/byok/resolve-user-api-key");

    const byokKey = await resolveUserApiKey(userId, "openrouter");
    const variants = await generateVariants({
      originalCaption: title,
      locale: "en",
      byokOpenRouterKey: byokKey ?? undefined,
    });

    return await createExperiment({
      videoId: campaignId,
      tenantId: userId,
      variantACaption: variants.variantACaption,
      variantBCaption: variants.variantBCaption,
      offerId: offerId ?? undefined,
    });
  } catch (err) {
    logger.warn(
      "[createCampaign] AB variant generation failed — campaign continues with original title",
      {
        campaignId,
        error: toError(err).message,
      },
    );
    return undefined;
  }
}

export async function tryDispatchCampaignCreatedEvent(params: {
  campaignId: string;
  userId: string;
  topic: string;
  audience: string;
  tier: Tier;
  abExperimentId?: string;
}): Promise<void> {
  try {
    await sendCampaignCreatedEvent(params);
  } catch {
    // Inngest not configured — campaign still created
  }
}

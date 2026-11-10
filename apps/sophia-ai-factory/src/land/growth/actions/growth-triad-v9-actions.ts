"use server";

import { z } from "zod";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { enforceCommercialFeatureForUser } from "@/seed/config/enforce-commercial-feature-server";
import { Result, success, failure } from "@/seed/types/result";
import { inngest } from "@/seed/inngest/client";
import { logger } from "@/seed/utils/logger-utility";
import { ScriptCultureIndexRequestSchema, TrafficRedirect, ShadowbanTelemetryEvent } from "@/seed/types/growth-triad-v9-types";

export async function getRoutingTopologyAction(): Promise<
  Result<TrafficRedirect[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure(new Error("Unauthorized"));
    }

    const gate = await enforceCommercialFeatureForUser(user.id, "growth_triad_bandit_kelly");
    if (!gate.ok) {
      return failure(new Error(`FEATURE_LOCKED: ${gate.error.message}`));
    }

    const topologyInfo: TrafficRedirect[] = [
      {
        sourceUrl: "https://example.com/source1",
        targetUrl: "https://example.com/target1",
        weight: 80,
      },
    ];

    return success(topologyInfo);
  } catch (error) {
    logger.error("[growth-triad-v9-actions] getRoutingTopologyAction failed", error instanceof Error ? error : undefined);
    return failure(new Error("Failed to get routing topology"));
  }
}

export async function getShadowbanMatrixAction(): Promise<
  Result<ShadowbanTelemetryEvent[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure(new Error("Unauthorized"));
    }

    const gate = await enforceCommercialFeatureForUser(user.id, "growth_triad_bandit_kelly");
    if (!gate.ok) {
      return failure(new Error(`FEATURE_LOCKED: ${gate.error.message}`));
    }

    const events: ShadowbanTelemetryEvent[] = [
      {
        videoId: "vid_123",
        accountId: "acc_456",
        metadataEntropy: 0.85,
        postTimingMs: 1690000000000,
        hashtags: ["#fyp", "#viral"],
        platform: "TIKTOK",
      },
    ];

    return success(events);
  } catch (error) {
    logger.error("[growth-triad-v9-actions] getShadowbanMatrixAction failed", error instanceof Error ? error : undefined);
    return failure(new Error("Failed to get shadowban matrix"));
  }
}

export async function requestCulturalScoresAction(
  request: unknown,
): Promise<Result<{ status: string; id: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure(new Error("Unauthorized"));
    }

    const gate = await enforceCommercialFeatureForUser(user.id, "growth_triad_bandit_kelly");
    if (!gate.ok) {
      return failure(new Error(`FEATURE_LOCKED: ${gate.error.message}`));
    }

    const parsedRequest = ScriptCultureIndexRequestSchema.parse(request);

    await inngest.send({
      name: "semantic.culture.scored",
      data: {
        ...parsedRequest,
        score: 0.95,
        cultureMatch: "HIGH",
      },
    });

    return success({
      status: "success",
      id: parsedRequest.scriptId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return failure(new Error("Validation Error: Invalid cultural score request"));
    }
    logger.error("[growth-triad-v9-actions] requestCulturalScoresAction failed", error instanceof Error ? error : undefined);
    return failure(new Error("Failed to request cultural scores"));
  }
}

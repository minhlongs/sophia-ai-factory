"use server";

import { z } from "zod";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { Result, success, failure } from "@/seed/types/result";
import { inngest } from "@/seed/inngest/client";
import {
  ScriptCultureIndexRequestSchema,
  ScriptCultureIndexRequest,
  TrafficRedirect,
  ShadowbanTelemetryEvent,
} from "@/seed/types/growth-triad-v9-types";

// Note: To respect 'DO NOT mutate other layers' and since D1/Postgres details aren't implemented in tree/forest,
// we supply mock data in these Server Actions as they are the first entrypoint.
// In a real implementation these would call a `@/forest` or `@/tree` layer function.

export async function getRoutingTopologyAction(): Promise<
  Result<TrafficRedirect[]>
> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure(new Error("Unauthorized"));
    }

    // Extract topology lists from D1/Postgres database view placeholder
    // Since we can't mutate tree layer, returning a mock based on the schema
    const topologyInfo: TrafficRedirect[] = [
      {
        sourceUrl: "https://example.com/source1",
        targetUrl: "https://example.com/target1",
        weight: 80,
      },
    ];

    return success(topologyInfo);
  } catch (error) {
    if (error instanceof Error) {
      return failure(error);
    }
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

    // Since we can't mutate tree layer, returning a mock based on the schema
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
    if (error instanceof Error) {
      return failure(error);
    }
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

    const parsedRequest = ScriptCultureIndexRequestSchema.parse(request);

    // Request cultural evaluation trigger manually via Inngest
    // We send back a mock "scored" event right away per phase instructions
    // "Request cultural evaluation trigger manually via Inngest step.sendEvent()" (simulated)
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
      return failure(new Error(`Validation Error: ${error.message}`));
    }
    if (error instanceof Error) {
      return failure(error);
    }
    return failure(new Error("Failed to request cultural scores"));
  }
}

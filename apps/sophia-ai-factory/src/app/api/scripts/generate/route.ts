// requestId is an ephemeral correlation ID — no DB row is persisted in this phase.
// Persistence (D1 videos table) is deferred to a future phase.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { getUserTier } from "@/seed/db/get-user-tier";
import { generateScript, selectModelForTier } from "@/seed/ai/script-generator";
import { logger } from "@/seed/utils/logger-utility";
import type { Tier } from "@/seed/types";

const TIER_RANK: Record<Tier, number> = {
  BASIC: 0,
  PREMIUM: 1,
  ENTERPRISE: 2,
  MASTER: 3,
};

const generateScriptSchema = z.object({
  topic: z.string().min(1, "topic is required").max(500).trim(),
  audience: z.string().min(1, "audience is required").max(300).trim(),
  durationSec: z.number().int().min(10).max(300).optional().default(30),
});

export async function POST(request: Request): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const log = logger.withRequestId(requestId);

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = await getUserTier(user.id);
  if (TIER_RANK[tier] < TIER_RANK.BASIC) {
    return NextResponse.json(
      { error: "Insufficient tier", requiredTier: "BASIC" },
      { status: 402 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = generateScriptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { topic, audience, durationSec } = parsed.data;
  // Server-resolved tier — client-supplied tier is ignored (defense in depth)
  const effectiveTier = tier;
  const model = selectModelForTier(effectiveTier);

  try {
    log.info("Script generation started", { userId: user.id, tier: effectiveTier, topic });

    const script = await generateScript({
      topic,
      audience,
      tier: effectiveTier,
      userId: user.id,
    });

    if (script.scenes.length < 2) {
      throw new Error("Generator returned insufficient scenes");
    }

    log.info("Script generation completed", {
      userId: user.id,
      scenes: script.scenes.length,
      totalDuration: script.total_duration,
    });

    return NextResponse.json({
      requestId,
      content: {
        hook: script.scenes[0]?.narration ?? "",
        body: script.scenes.slice(1, -1).map((s) => s.narration).join(" "),
        cta: script.scenes[script.scenes.length - 1]?.narration ?? "",
      },
      metadata: {
        tier: effectiveTier,
        model,
        generatedAt: new Date().toISOString(),
        durationSec,
      },
    });
  } catch (error) {
    log.error(
      "Script generation failed",
      error instanceof Error ? error : new Error(String(error)),
      { userId: user.id, topic }
    );
    return NextResponse.json({ error: "Script generation failed" }, { status: 500 });
  }
}

// requestId is an ephemeral correlation ID — no DB row is persisted in this phase.
// Persistence (D1 videos table) is deferred to a future phase.
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { resolveUserTier } from "@/seed/db/resolve-user-tier";
import {
  generateScript,
  selectModelForTier,
  validateParsedScriptStructure,
  InvalidScriptStructureError,
} from "@/seed/ai/script-generator";
import { getScriptSteeringForUser } from "@/land/growth-v16/prior-script-bridge";
import { logger } from "@/seed/utils/logger-utility";
import type { Tier } from "@/seed/types";
import { lookupUserApiKey } from "@/tree/byok/user-api-key-store";
import { ProviderInvalidKeyError, ProviderQuotaExceededError } from "@/seed/services/errors";

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

  const tier = await resolveUserTier(user.id);
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
    const key = await lookupUserApiKey(user.id, 'openrouter');
    if (key.status === 'NOT_CONFIGURED' || (key.status === 'FOUND' && !key.key.trim())) {
      return NextResponse.json({
        error: 'Connect your OpenRouter key in Settings before generating a script. / Kết nối khóa OpenRouter trong Cài đặt trước khi tạo kịch bản.',
        code: 'OPENROUTER_KEY_REQUIRED',
      }, { status: 422 });
    }
    if (key.status !== 'FOUND') {
      return NextResponse.json({
        error: 'Your OpenRouter key is unavailable. Reconnect it in Settings or retry later. / Khóa OpenRouter chưa khả dụng. Kết nối lại trong Cài đặt hoặc thử lại sau.',
        code: 'OPENROUTER_KEY_UNAVAILABLE',
      }, { status: 503 });
    }

    log.info("Script generation started", { userId: user.id, tier: effectiveTier, topic });

    const steering = await getScriptSteeringForUser(user.id, topic, audience).catch(() => undefined);

    const script = await generateScript({
      topic,
      audience,
      tier: effectiveTier,
      durationSec,
      userId: user.id,
      steering,
    }, { funding: { fund: 'byok', apiKey: key.key }, minScenes: 3 });

    const validatedScript = validateParsedScriptStructure(script, {
      minScenes: 3,
      targetDurationSec: durationSec,
    });

    const firstScene = validatedScript.scenes[0];
    const lastScene = validatedScript.scenes[validatedScript.scenes.length - 1];
    const bodyText = validatedScript.scenes
      .slice(1, -1)
      .map((s) => s.narration)
      .join(" ")
      .trim();
    if (!firstScene || !lastScene || bodyText.length === 0) {
      throw new InvalidScriptStructureError("scenes must contain non-empty hook, body, and cta");
    }

    log.info("Script generation completed", {
      userId: user.id,
      scenes: validatedScript.scenes.length,
      totalDuration: validatedScript.total_duration,
    });

    return NextResponse.json({
      requestId,
      content: {
        hook: firstScene.narration,
        body: bodyText,
        cta: lastScene.narration,
      },
      metadata: {
        tier: effectiveTier,
        model,
        generatedAt: new Date().toISOString(),
        durationSec,
      },
    });
  } catch (error) {
    if (error instanceof ProviderInvalidKeyError) {
      return NextResponse.json({
        error: 'OpenRouter rejected your key. Reconnect it in Settings. / OpenRouter từ chối khóa của bạn. Kết nối lại trong Cài đặt.',
        code: 'OPENROUTER_KEY_INVALID',
      }, { status: 422 });
    }
    if (error instanceof ProviderQuotaExceededError) {
      return NextResponse.json({
        error: 'Your OpenRouter credits are exhausted. Add credits with your provider and retry. / Tín dụng OpenRouter đã hết. Nạp thêm tại nhà cung cấp rồi thử lại.',
        code: 'OPENROUTER_CREDITS_EXHAUSTED',
      }, { status: 402 });
    }
    if (error instanceof InvalidScriptStructureError) {
      log.error("Script output failed contract validation", error, {
        userId: user.id,
        topic,
        durationSec,
      });
      return NextResponse.json({
        error: 'Generated script failed validation. Please retry. / Kịch bản tạo ra không hợp lệ. Vui lòng thử lại.',
        code: 'INVALID_SCRIPT_OUTPUT',
      }, { status: 502 });
    }
    log.error(
      "Script generation failed",
      error instanceof Error ? error : new Error(String(error)),
      { userId: user.id, topic }
    );
    return NextResponse.json({ error: "Script generation failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { MissingCredentialsError } from "@/lib/services/errors";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { getUserTier } from "@/seed/db/get-user-tier";
import { createServerClient } from "@/seed/db/client";
import { createVideoSchema } from "@/lib/schemas";
import { logger } from "@/seed/utils/logger-utility";
import { reserveVideoSlot, releaseVideoSlot } from "@/forest/quota/video-quota";

const VIDEO_ALLOWED_TIERS = new Set(['PREMIUM', 'ENTERPRISE', 'MASTER']);

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // P0: Tier gate — only PREMIUM/ENTERPRISE/MASTER can create videos
    const tier = await getUserTier(user.id);
    if (!VIDEO_ALLOWED_TIERS.has(tier)) {
      return NextResponse.json(
        { error: "Video creation requires PREMIUM tier or higher", upgrade: "/pricing" },
        { status: 402 }
      );
    }

    const body = await req.json();
    const validation = createVideoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { avatarId, voiceId, script, title, scriptRequestId } =
      validation.data;
    const finalTitle = title || `Video for ${user.email}`;

    // P1: Atomic monthly quota reservation — eliminates TOCTOU race so
    // concurrent BYOK requests cannot burst past the tier limit.
    const reservation = await reserveVideoSlot(user.id, tier);
    if (!reservation.reserved) {
      return NextResponse.json(
        { error: "quota_exceeded", limit: reservation.limit, used: reservation.used, resetAt: reservation.resetAt },
        { status: 429 }
      );
    }

    let heygenJobId: string;
    try {
      const videoService = await ServiceFactory.getVideoService(user.id);
      heygenJobId = await videoService.createVideo({
        avatarId,
        voiceId,
        script,
        title: finalTitle,
      });
    } catch (err) {
      // HeyGen failed after we already reserved a slot — give it back so the
      // user is not charged for a video that never existed.
      try {
        await releaseVideoSlot(user.id);
      } catch (releaseErr) {
        logger.error(
          "[create-video] Failed to release video quota slot after HeyGen failure",
          releaseErr instanceof Error ? releaseErr : undefined,
          { userId: user.id }
        );
      }

      if (err instanceof MissingCredentialsError) {
        return NextResponse.json(
          { error: "video_service_unavailable", code: "MISSING_KEY" },
          { status: 503 }
        );
      }
      throw err;
    }

    // Persist to D1 — failures are logged and surfaced to caller.
    try {
      const db = createServerClient();
      await db.from("videos").insert({
        user_id: user.id,
        heygen_job_id: heygenJobId,
        title: finalTitle,
        status: "processing",
        script_request_id: scriptRequestId ?? null,
      });
    } catch (dbErr) {
      logger.error(
        "[create-video] D1 INSERT failed after HeyGen job submitted",
        dbErr instanceof Error ? dbErr : undefined,
        { heygenJobId, userId: user.id }
      );
      return NextResponse.json(
        {
          error:
            "Video created but not persisted. Check /dashboard/videos in a few minutes.",
          code: "DB_FAILED",
          videoId: heygenJobId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { videoId: heygenJobId, status: "processing" },
      { status: 200 }
    );
  } catch (err) {
    logger.error("[create-video] Unhandled error", err instanceof Error ? err : undefined);
    return NextResponse.json(
      { error: "Failed to create video job" },
      { status: 500 }
    );
  }
}

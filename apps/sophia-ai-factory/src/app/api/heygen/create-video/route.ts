import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { MissingCredentialsError } from "@/lib/services/errors";
import { getCurrentUser } from "@/lib/better-auth-session";
import { createServerClient } from "@/lib/db/client";
import { createVideoSchema } from "@/lib/schemas";
import { logger } from "@/lib/utils/logger-utility";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    let heygenJobId: string;
    try {
      const videoService = ServiceFactory.getVideoService();
      heygenJobId = await videoService.createVideo({
        avatarId,
        voiceId,
        script,
        title: finalTitle,
      });
    } catch (err) {
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

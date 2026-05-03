import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { createServerClient } from "@/seed/db/client";
import { logger } from "@/seed/utils/logger-utility";

interface HeygenStatus {
  status?: string;
  video_url?: string | null;
  thumbnail_url?: string | null;
  duration?: number | null;
  error?: string | null;
}

interface StatusResponse {
  status: string | undefined;
  video_url: string | null;
  thumbnail_url: string | null;
  duration_sec: number | null;
  error: string | null;
}

const TERMINAL = new Set(["completed", "failed"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "Video ID is required" },
        { status: 400 }
      );
    }

    const db = createServerClient();
    const { data: ownership } = await db
      .from("videos")
      .select("user_id")
      .eq("heygen_job_id", id)
      .maybeSingle();

    const owner = (ownership as { user_id?: string } | null)?.user_id;
    if (owner && owner !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const videoService = await ServiceFactory.getVideoService(user.id);
    const raw = (await videoService.getVideoStatus(id)) as HeygenStatus;

    // Coerce HeyGen error responses to terminal 'failed' status before persisting.
    const effectiveStatus =
      raw?.error && raw.status && !TERMINAL.has(raw.status)
        ? "failed"
        : raw?.status;

    const response: StatusResponse = {
      status: effectiveStatus,
      video_url: raw?.video_url ?? null,
      thumbnail_url: raw?.thumbnail_url ?? null,
      duration_sec:
        typeof raw?.duration === "number" ? raw.duration : null,
      error: raw?.error ?? null,
    };

    if (effectiveStatus && TERMINAL.has(effectiveStatus) && owner === user.id) {
      try {
        await db
          .from("videos")
          .update({
            status: effectiveStatus,
            video_url: response.video_url,
            thumbnail_url: response.thumbnail_url,
            duration_sec: response.duration_sec,
            error: response.error,
            updated_at: new Date().toISOString(),
          })
          .eq("heygen_job_id", id)
          .eq("user_id", user.id);
        logger.info(
          "[status] Terminal state persisted to D1",
          { heygenJobId: id, status: effectiveStatus, userId: user.id }
        );
      } catch (dbErr) {
        // Log but don't fail the request — client still gets the status.
        logger.error(
          "[status] D1 UPDATE failed for terminal state",
          dbErr instanceof Error ? dbErr : undefined,
          { heygenJobId: id, status: effectiveStatus, userId: user.id }
        );
      }
    }

    return NextResponse.json(response);
  } catch (err) {
    logger.error("[status] Unhandled error", err instanceof Error ? err : undefined);
    return NextResponse.json(
      { error: "Failed to fetch video status" },
      { status: 500 }
    );
  }
}

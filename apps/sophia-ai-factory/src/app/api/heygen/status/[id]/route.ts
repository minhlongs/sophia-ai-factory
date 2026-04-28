import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { getCurrentUser } from "@/lib/better-auth-session";
import { createServerClient } from "@/lib/db/client";

interface HeygenStatus {
  status?: string;
  video_url?: string | null;
  thumbnail_url?: string | null;
  duration?: number | null;
  error?: string | null;
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

    const videoService = ServiceFactory.getVideoService();
    const status = (await videoService.getVideoStatus(id)) as HeygenStatus;

    if (status?.status && TERMINAL.has(status.status)) {
      try {
        const db = createServerClient();
        await db
          .from("videos")
          .update({
            status: status.status,
            video_url: status.video_url ?? null,
            thumbnail_url: status.thumbnail_url ?? null,
            duration_sec:
              typeof status.duration === "number" ? status.duration : null,
            error: status.error ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("heygen_job_id", id)
          .eq("user_id", user.id);
      } catch {
        // best-effort — status fetch must still succeed
      }
    }

    return NextResponse.json(status);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch video status" },
      { status: 500 }
    );
  }
}

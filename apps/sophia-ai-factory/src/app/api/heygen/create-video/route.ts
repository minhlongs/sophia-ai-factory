import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { getCurrentUser } from "@/lib/better-auth-session";
import { createServerClient } from "@/lib/db/client";
import { createVideoSchema } from "@/lib/schemas";

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

    const videoService = ServiceFactory.getVideoService();
    const heygenJobId = await videoService.createVideo({
      avatarId,
      voiceId,
      script,
      title: finalTitle,
    });

    // Best-effort persistence — failures must not break the render flow.
    try {
      const db = createServerClient();
      await db.from("videos").insert({
        user_id: user.id,
        heygen_job_id: heygenJobId,
        title: finalTitle,
        status: "processing",
        script_request_id: scriptRequestId ?? null,
      });
    } catch {
      // swallowed: HeyGen job already submitted; gallery may show stale state.
    }

    return NextResponse.json({ videoId: heygenJobId });
  } catch {
    return NextResponse.json(
      { error: "Failed to create video job" },
      { status: 500 }
    );
  }
}

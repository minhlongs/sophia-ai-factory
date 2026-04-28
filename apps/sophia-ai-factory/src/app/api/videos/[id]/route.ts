import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/better-auth-session";
import { createServerClient } from "@/lib/db/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const db = createServerClient();
    const { data, error } = await db
      .from("videos")
      .select(
        "id, user_id, title, status, video_url, thumbnail_url, duration_sec, heygen_job_id, script_request_id, error, created_at, updated_at"
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch video" },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (data.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ video: data });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUserOrOpenclawBearer } from "@/seed/auth/openclaw-token";
import { createServerClient } from "@/seed/db/client";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  try {
    const user = await getCurrentUserOrOpenclawBearer(req.headers);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const parsed = listQuerySchema.safeParse({
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { limit, offset } = parsed.data;
    const db = createServerClient();
    const { data, error } = await db
      .from("videos")
      .select(
        "id, title, status, video_url, thumbnail_url, duration_sec, heygen_job_id, r2_key, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: "Failed to list videos" },
        { status: 500 }
      );
    }

    // Prefer R2_PUBLIC_BASE_URL (full URL); fall back to R2_PUBLIC_HOSTNAME
    // (hostname-only, used by the AI-prompt Inngest pipeline). Either env
    // produces stable public URLs that outlive HeyGen CDN signed links.
    const r2BaseRaw = process.env.R2_PUBLIC_BASE_URL
      ?? (process.env.R2_PUBLIC_HOSTNAME ? `https://${process.env.R2_PUBLIC_HOSTNAME}` : null);
    const r2Base = r2BaseRaw?.replace(/\/$/, '') ?? null;
    const videos = (data ?? []).map((v: Record<string, unknown>) => {
      if (r2Base && v.r2_key) {
        return { ...v, video_url: `${r2Base}/${v.r2_key}` };
      }
      return v;
    });

    return NextResponse.json({
      videos,
      pagination: { limit, offset, count: videos.length },
    });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

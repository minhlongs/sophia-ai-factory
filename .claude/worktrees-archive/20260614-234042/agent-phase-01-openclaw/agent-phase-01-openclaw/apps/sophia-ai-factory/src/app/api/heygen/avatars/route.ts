import { NextResponse } from "next/server";
import { ServiceFactory } from "@/land/services/factory";
import { getCurrentUser } from "@/seed/auth/better-auth-session";

// Module-level cache — best-effort within Cloudflare isolate lifetime (~5 min)
let AVATARS_CACHE: { data: unknown; expiresAt: number } | null = null;
const TTL = 5 * 60 * 1000; // 5 min

/** Exposed for testing only — resets the cache. */
export function _resetCacheForTest() { AVATARS_CACHE = null; }

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (AVATARS_CACHE && AVATARS_CACHE.expiresAt > Date.now()) {
      return NextResponse.json(AVATARS_CACHE.data);
    }

    const videoService = await ServiceFactory.getVideoService(user.id);
    const avatars = await videoService.listAvatars();
    const data = { avatars };
    AVATARS_CACHE = { data, expiresAt: Date.now() + TTL };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch avatars" }, { status: 500 });
  }
}

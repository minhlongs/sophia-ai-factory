import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { getCurrentUser } from "@/lib/better-auth-session";

// Module-level cache — best-effort within Cloudflare isolate lifetime (~5 min)
let VOICES_CACHE: { data: unknown; expiresAt: number } | null = null;
const TTL = 5 * 60 * 1000; // 5 min

/** Exposed for testing only — resets the cache. */
export function _resetCacheForTest() { VOICES_CACHE = null; }

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (VOICES_CACHE && VOICES_CACHE.expiresAt > Date.now()) {
      return NextResponse.json(VOICES_CACHE.data);
    }

    const videoService = await ServiceFactory.getVideoService(user.id);
    const voices = await videoService.listVoices();
    const data = { voices };
    VOICES_CACHE = { data, expiresAt: Date.now() + TTL };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch voices" }, { status: 500 });
  }
}

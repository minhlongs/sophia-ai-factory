import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";

export async function POST(req: Request) {
  const videoService = ServiceFactory.getVideoService();

  try {
    const body = await req.json();
    const { avatarId, voiceId, script, title } = body;

    if (!avatarId || !voiceId || !script) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const videoId = await videoService.createVideo({ avatarId, voiceId, script, title });
    return NextResponse.json({ videoId });
  } catch (error) {
    console.error("Create video error:", error);
    return NextResponse.json({ error: "Failed to create video job" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { createClient } from "@/lib/supabase/server";
import { createVideoSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const videoService = ServiceFactory.getVideoService();

  try {
    const body = await req.json();

    // Validate with Zod
    const validation = createVideoSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { avatarId, voiceId, script, title } = validation.data;

    const videoId = await videoService.createVideo({
      avatarId,
      voiceId,
      script,
      title: title || `Video for ${user.email}`
    });
    return NextResponse.json({ videoId });
  } catch (error) {
    console.error("Create video error:", error);
    return NextResponse.json({ error: "Failed to create video job" }, { status: 500 });
  }
}

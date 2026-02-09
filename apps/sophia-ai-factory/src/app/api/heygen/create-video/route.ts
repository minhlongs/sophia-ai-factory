import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { createClient } from "@/lib/supabase/server";
import { createVideoSchema } from "@/lib/schemas";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const videoService = ServiceFactory.getVideoService();
    const videoId = await videoService.createVideo({
      avatarId,
      voiceId,
      script,
      title: title || `Video for ${user.email}`
    });
    return NextResponse.json({ videoId });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create video job" }, { status: 500 });
  }
}

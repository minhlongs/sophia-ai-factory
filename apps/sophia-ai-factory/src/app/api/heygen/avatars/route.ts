import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const videoService = ServiceFactory.getVideoService();
    const avatars = await videoService.listAvatars();
    return NextResponse.json({ avatars });
  } catch {
    return NextResponse.json({ error: "Failed to fetch avatars" }, { status: 500 });
  }
}

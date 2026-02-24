import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    const videoService = ServiceFactory.getVideoService();
    const status = await videoService.getVideoStatus(id);
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: "Failed to fetch video status" }, { status: 500 });
  }
}

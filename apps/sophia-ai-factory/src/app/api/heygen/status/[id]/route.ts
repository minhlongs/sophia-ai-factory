import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { getCurrentUser } from "@/lib/better-auth-session";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {

    const user = await getCurrentUser();

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

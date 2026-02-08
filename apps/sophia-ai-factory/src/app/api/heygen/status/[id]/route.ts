import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Video ID is required" }, { status: 400 });
    }

    const videoService = ServiceFactory.getVideoService();
    const status = await videoService.getVideoStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Status API error:", error);
    return NextResponse.json({ error: "Failed to fetch video status" }, { status: 500 });
  }
}

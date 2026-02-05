import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const videoService = ServiceFactory.getVideoService();
  const { id } = await params;

  try {
    const status = await videoService.getVideoStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Status API error:", error);
    return NextResponse.json({ error: "Failed to fetch video status" }, { status: 500 });
  }
}

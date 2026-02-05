import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";

export async function GET() {
  const videoService = ServiceFactory.getVideoService();

  try {
    const avatars = await videoService.listAvatars();
    return NextResponse.json({ avatars });
  } catch (error) {
    console.error("Avatar API error:", error);
    return NextResponse.json({ error: "Failed to fetch avatars" }, { status: 500 });
  }
}

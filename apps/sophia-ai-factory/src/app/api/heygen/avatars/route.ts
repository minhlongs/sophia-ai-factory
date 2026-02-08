import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";

export async function GET() {
  try {
    const videoService = ServiceFactory.getVideoService();
    const avatars = await videoService.listAvatars();
    return NextResponse.json({ avatars });
  } catch (error) {
    console.error("Avatar API error:", error);
    return NextResponse.json({ error: "Failed to fetch avatars" }, { status: 500 });
  }
}

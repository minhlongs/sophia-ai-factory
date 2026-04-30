import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";
import { getCurrentUser } from "@/lib/better-auth-session";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const videoService = await ServiceFactory.getVideoService(user.id);
    const avatars = await videoService.listAvatars();
    return NextResponse.json({ avatars });
  } catch {
    return NextResponse.json({ error: "Failed to fetch avatars" }, { status: 500 });
  }
}

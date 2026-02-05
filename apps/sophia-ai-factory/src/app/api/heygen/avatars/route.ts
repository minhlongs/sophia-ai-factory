import { NextResponse } from "next/server";
import { getHeyGenClient } from "@/lib/heygen/heygen-client";

export async function GET() {
  const client = getHeyGenClient();
  if (!client) {
    // Return empty list if not configured, or error.
    // Since this might be called by UI, returning empty with warning is often safer for dev.
    return NextResponse.json({ avatars: [] });
  }

  try {
    const avatars = await client.listAvatars();
    return NextResponse.json({ avatars });
  } catch (error) {
    console.error("Avatar API error:", error);
    return NextResponse.json({ error: "Failed to fetch avatars" }, { status: 500 });
  }
}

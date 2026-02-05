import { NextResponse } from "next/server";
import { getHeyGenClient } from "@/lib/heygen/heygen-client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = getHeyGenClient();
  if (!client) {
    return NextResponse.json({ error: "HeyGen configuration missing" }, { status: 503 });
  }

  const { id } = await params;

  try {
    const status = await client.getVideoStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Status API error:", error);
    return NextResponse.json({ error: "Failed to fetch video status" }, { status: 500 });
  }
}

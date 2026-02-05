import { NextResponse } from "next/server";
import { getHeyGenClient } from "@/lib/heygen/heygen-client";

export async function GET() {
  const client = getHeyGenClient();
  if (!client) {
    return NextResponse.json({ voices: [] });
  }

  try {
    const voices = await client.listVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    console.error("Voice API error:", error);
    return NextResponse.json({ error: "Failed to fetch voices" }, { status: 500 });
  }
}

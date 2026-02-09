import { NextResponse } from "next/server";
import { ServiceFactory } from "@/lib/services/factory";

export async function GET() {
  try {
    const videoService = ServiceFactory.getVideoService();
    const voices = await videoService.listVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch voices" }, { status: 500 });
  }
}

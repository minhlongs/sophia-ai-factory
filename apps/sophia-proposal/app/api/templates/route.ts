import { NextRequest, NextResponse } from "next/server";
import { getSystemTemplate, getAllSystemTemplates } from "@/lib/ai/proposal-templates";

// API routes are dynamic by default
export const dynamic = "force-dynamic";

/**
 * GET /api/templates
 * Get all available proposal templates
 */
export async function GET() {
  try {
    const templates = getAllSystemTemplates();
    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error("Get templates error:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Create a new custom template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // TODO: Save to database
    return NextResponse.json({
      success: true,
      message: "Template created (not yet persisted)",
    });
  } catch (error) {
    console.error("Create template error:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}

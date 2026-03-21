import { NextRequest, NextResponse } from "next/server";

// API routes are dynamic by default
export const dynamic = "force-dynamic";

/**
 * GET /api/proposals
 * List all proposals for current organization
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Get current user's org ID from auth session
    // TODO: Fetch from database
    return NextResponse.json({
      success: true,
      proposals: [],
    });
  } catch (error) {
    console.error("Get proposals error:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/proposals
 * Create a new proposal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // TODO: Validate input
    // TODO: Save to database
    return NextResponse.json({
      success: true,
      message: "Proposal created (not yet persisted)",
    });
  } catch (error) {
    console.error("Create proposal error:", error);
    return NextResponse.json(
      { error: "Failed to create proposal" },
      { status: 500 }
    );
  }
}

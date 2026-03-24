import { NextRequest, NextResponse } from "next/server";

// API routes are dynamic by default
export const dynamic = "force-dynamic";

const NOT_IMPLEMENTED = NextResponse.json(
  { error: "Proposals feature coming soon", code: "NOT_IMPLEMENTED" },
  { status: 501 }
);

/**
 * GET /api/proposals
 */
export async function GET(_request: NextRequest) {
  return NOT_IMPLEMENTED;
}

/**
 * POST /api/proposals
 */
export async function POST(_request: NextRequest) {
  return NOT_IMPLEMENTED;
}

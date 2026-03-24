import { NextRequest, NextResponse } from "next/server";

// API routes are dynamic by default
export const dynamic = "force-dynamic";

const NOT_IMPLEMENTED = NextResponse.json(
  { error: "Proposals feature coming soon", code: "NOT_IMPLEMENTED" },
  { status: 501 }
);

/**
 * GET /api/proposals/[id]
 */
export async function GET(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NOT_IMPLEMENTED;
}

/**
 * PUT /api/proposals/[id]
 */
export async function PUT(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NOT_IMPLEMENTED;
}

/**
 * DELETE /api/proposals/[id]
 */
export async function DELETE(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NOT_IMPLEMENTED;
}

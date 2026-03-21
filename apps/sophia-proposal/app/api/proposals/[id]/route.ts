import { NextRequest, NextResponse } from "next/server";

// API routes are dynamic by default
export const dynamic = "force-dynamic";

/**
 * GET /api/proposals/[id]
 * Get a specific proposal by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // TODO: Get proposal from database
    // TODO: Check user has access to this proposal
    return NextResponse.json({
      success: true,
      proposal: {
        id,
        clientName: "John Smith",
        clientCompany: "Acme Corp",
        status: "draft",
        inputData: {},
        generatedContent: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Get proposal error:", error);
    return NextResponse.json(
      { error: "Failed to fetch proposal" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/proposals/[id]
 * Update a proposal
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    // TODO: Validate input
    // TODO: Update database
    return NextResponse.json({
      success: true,
      message: "Proposal updated (not yet persisted)",
    });
  } catch (error) {
    console.error("Update proposal error:", error);
    return NextResponse.json(
      { error: "Failed to update proposal" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/proposals/[id]
 * Delete a proposal
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // TODO: Delete from database
    return NextResponse.json({
      success: true,
      message: "Proposal deleted (not yet persisted)",
    });
  } catch (error) {
    console.error("Delete proposal error:", error);
    return NextResponse.json(
      { error: "Failed to delete proposal" },
      { status: 500 }
    );
  }
}

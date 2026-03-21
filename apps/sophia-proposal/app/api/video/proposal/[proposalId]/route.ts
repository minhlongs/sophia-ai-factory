/**
 * GET /api/video/proposal/[proposalId]
 *
 * List all videos for a specific proposal
 *
 * Flow:
 * 1. Authenticate user
 * 2. Verify org membership and proposal access
 * 3. Fetch all videos for the proposal
 * 4. Return video list
 */

import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServerClient } from "@/lib/supabase/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proposalId: string }> }
) {
  try {
    // 1. Authenticate user
    const authClient = createAuthClient(
      request.headers.get("authorization")?.split(" ")[1]
    );
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { proposalId } = await params;

    // 2. Get proposal to verify access
    const serverClient = createServerClient();
    const { data: proposal } = await serverClient
      .from("proposals")
      .select("org_id")
      .eq("id", proposalId)
      .single();

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    // 3. Verify org membership
    const { data: membership } = await serverClient
      .from("organization_members")
      .select("org_id")
      .eq("org_id", proposal.org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // 4. Fetch all videos for this proposal
    const { data: videos, error: fetchError } = await serverClient
      .from("video_assets")
      .select(
        `
        id,
        video_type,
        status,
        video_url,
        preview_url,
        duration_seconds,
        mcu_cost,
        created_at,
        ready_at
      `
      )
      .eq("proposal_id", proposalId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching videos:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch videos" },
        { status: 500 }
      );
    }

    // 5. Return response
    return NextResponse.json({
      videos: (videos || []).map((v) => ({
        id: v.id,
        videoType: v.video_type,
        status: v.status,
        videoUrl: v.video_url,
        previewUrl: v.preview_url,
        duration: v.duration_seconds,
        mcuCost: v.mcu_cost,
        createdAt: v.created_at,
        readyAt: v.ready_at,
      })),
      total: videos?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching proposal videos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

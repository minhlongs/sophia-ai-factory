/**
 * GET /api/video/[id]
 *
 * Get video generation status and details
 *
 * Flow:
 * 1. Authenticate user
 * 2. Get video asset record
 * 3. Verify org membership
 * 4. Optionally poll HeyGen for latest status
 * 5. Return video details
 */

import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServerClient } from "@/lib/db/client";
import { getVideoStatus } from "@/lib/video/heygen-client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: videoId } = await params;

    // 2. Get video asset record
    const serverClient = createServerClient();
    const { data: video, error: fetchError } = await serverClient
      .from("video_assets")
      .select("*")
      .eq("id", videoId)
      .single();

    if (fetchError || !video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // 3. Verify org membership
    const { data: membership } = await serverClient
      .from("organization_members")
      .select("org_id")
      .eq("org_id", video.org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // 4. If video is still processing, check HeyGen for latest status
    if (video.status === "pending" || video.status === "processing") {
      try {
        const heygenStatus = await getVideoStatus(video.heygen_video_id);

        if (heygenStatus.data) {
          const heygenData = heygenStatus.data;

          // Map HeyGen status to our status
          const statusMap: Record<string, "pending" | "processing" | "ready" | "failed"> = {
            queued: "pending",
            processing: "processing",
            completed: "ready",
            failed: "failed",
          };

          const newStatus = statusMap[heygenData.status] || "pending";

          // Update local record if status changed
          if (newStatus !== video.status) {
            const updateData: Record<string, unknown> = {
              status: newStatus,
              heygen_response: heygenData,
            };

            if (newStatus === "ready") {
              updateData.video_url = heygenData.video_url;
              updateData.preview_url = heygenData.preview_url;
              updateData.duration_seconds = heygenData.duration;
              updateData.ready_at = new Date().toISOString();
            } else if (newStatus === "failed") {
              updateData.error_message = heygenData.error_message;
            }

            await serverClient
              .from("video_assets")
              .update(updateData)
              .eq("id", videoId);

            video.status = newStatus;
            if (heygenData.video_url) video.video_url = heygenData.video_url;
            if (heygenData.preview_url) video.preview_url = heygenData.preview_url;
            if (heygenData.duration) video.duration_seconds = heygenData.duration;
          }
        }
      } catch (error) {
        console.error("Error checking HeyGen status:", error);
        // Continue with cached status if HeyGen check fails
      }
    }

    // 5. Return response
    return NextResponse.json({
      videoId: video.id,
      heygenVideoId: video.heygen_video_id,
      status: video.status,
      videoType: video.video_type,
      videoUrl: video.video_url,
      previewUrl: video.preview_url,
      duration: video.duration_seconds,
      mcuCost: video.mcu_cost,
      errorMessage: video.error_message,
      createdAt: video.created_at,
      readyAt: video.ready_at,
    });
  } catch (error) {
    console.error("Error fetching video status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/video/[id]
 *
 * Delete a video (only if not yet processed to avoid MCU waste)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: videoId } = await params;

    // 2. Get video record
    const serverClient = createServerClient();
    const { data: video } = await serverClient
      .from("video_assets")
      .select("org_id, status")
      .eq("id", videoId)
      .single();

    if (!video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    // 3. Verify org membership
    const { data: membership } = await serverClient
      .from("organization_members")
      .select("role")
      .eq("org_id", video.org_id)
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can delete videos" },
        { status: 403 }
      );
    }

    // 4. Only allow deletion if not yet ready (MCU not deducted)
    if (video.status === "ready") {
      return NextResponse.json(
        { error: "Cannot delete completed videos" },
        { status: 400 }
      );
    }

    // 5. Delete video record
    await serverClient.from("video_assets").delete().eq("id", videoId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting video:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

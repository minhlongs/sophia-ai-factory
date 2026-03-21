/**
 * POST /api/video/generate
 *
 * Generate a new video for a proposal
 *
 * Flow:
 * 1. Validate request
 * 2. Check MCU balance
 * 3. Create HeyGen video task
 * 4. Create video_assets record
 * 5. Return video ID for polling
 */

import { NextRequest, NextResponse } from "next/server";
import { createAuthClient, createServerClient } from "@/lib/db/client";
import { generateVideoSchema } from "@/lib/validators/video";
import { createVideoTask, estimateDuration } from "@/lib/video/heygen-client";
import { calculateMcuCost } from "@/lib/billing/mcu-pricing";
import { getOrgId } from "@/lib/org";

export async function POST(request: NextRequest) {
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

    // 2. Parse and validate request
    const body = await request.json();
    const validated = generateVideoSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validated.error.errors },
        { status: 400 }
      );
    }

    const {
      proposalId,
      videoType,
      templateId,
      scriptText,
      avatarId,
      voiceId,
      backgroundId,
    } = validated.data;

    // 3. Get user's organization
    const serverClient = createServerClient();
    const orgId = await getOrgId(user.id, serverClient);

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // 4. Check MCU balance
    const { data: balance } = await serverClient
      .from("org_balances")
      .select("balance")
      .eq("org_id", orgId)
      .single();

    if (!balance) {
      return NextResponse.json(
        { error: "No balance found. Please add credits." },
        { status: 402 }
      );
    }

    // 5. Get user's subscription tier for discount
    const { data: subscription } = await serverClient
      .from("subscriptions")
      .select("tier_name")
      .eq("org_id", orgId)
      .eq("status", "active")
      .single();

    // 6. Calculate MCU cost with tier discount
    const mcuCost = calculateMcuCost(`video:${videoType}`, subscription?.tier_name);

    if (balance.balance < mcuCost) {
      return NextResponse.json(
        {
          error: "Insufficient balance",
          required: mcuCost,
          available: balance.balance,
        },
        { status: 402 }
      );
    }

    // 6. Reserve MCU immediately to prevent race condition
    // Deduct balance upfront; refund later if video fails
    const { error: reserveError } = await serverClient.rpc(
      "reserve_mcu_for_video",
      { p_org_id: orgId, p_amount: mcuCost }
    );

    if (reserveError) {
      console.error("Failed to reserve MCU:", reserveError);
      return NextResponse.json(
        { error: "Failed to reserve balance" },
        { status: 500 }
      );
    }

    // 7. Create HeyGen video task
    let heygenResponse;
    try {
      heygenResponse = await createVideoTask({
        proposalId,
        videoType,
        templateId,
        scriptText,
        avatarId,
        voiceId,
        backgroundId,
      });
    } catch (error) {
      // Refund reservation since HeyGen call failed
      await serverClient.rpc("refund_mcu_reservation", {
        p_org_id: orgId,
        p_amount: mcuCost,
      });
      console.error("HeyGen API error:", error);
      return NextResponse.json(
        {
          error: "Failed to create video task",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 502 }
      );
    }

    if (!heygenResponse.data?.video_id) {
      // Refund reservation since we have no video ID
      await serverClient.rpc("refund_mcu_reservation", {
        p_org_id: orgId,
        p_amount: mcuCost,
      });
      return NextResponse.json(
        { error: "HeyGen did not return a video ID" },
        { status: 502 }
      );
    }

    // 8. Idempotency check: reject duplicate heygen_video_id
    const { data: existing } = await serverClient
      .from("video_assets")
      .select("id")
      .eq("heygen_video_id", heygenResponse.data.video_id)
      .maybeSingle();

    if (existing) {
      // Refund since this is a duplicate request
      await serverClient.rpc("refund_mcu_reservation", {
        p_org_id: orgId,
        p_amount: mcuCost,
      });
      return NextResponse.json(
        { error: "Duplicate video task", videoId: existing.id },
        { status: 409 }
      );
    }

    // 9. Create video asset record with mcu_reserved flag
    const { data: videoAsset, error: insertError } = await serverClient
      .from("video_assets")
      .insert({
        org_id: orgId,
        proposal_id: proposalId,
        heygen_video_id: heygenResponse.data.video_id,
        video_type: videoType,
        template_id: templateId,
        status: "processing",
        script_text: scriptText,
        avatar_id: avatarId,
        voice_id: voiceId,
        background_id: backgroundId,
        mcu_cost: mcuCost,
        mcu_reserved: true,
        heygen_response: heygenResponse.data,
      })
      .select()
      .single();

    if (insertError) {
      // Refund reservation since record creation failed
      await serverClient.rpc("refund_mcu_reservation", {
        p_org_id: orgId,
        p_amount: mcuCost,
      });
      console.error("Error creating video asset:", insertError);
      return NextResponse.json(
        { error: "Failed to create video record" },
        { status: 500 }
      );
    }

    // 10. Return response
    return NextResponse.json({
      success: true,
      videoId: videoAsset.id,
      heygenVideoId: heygenResponse.data.video_id,
      status: "processing",
      estimatedTime: estimateDuration(scriptText) + 30, // Add 30s for processing
      mcuCost,
    });
  } catch (error) {
    console.error("Error generating video:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

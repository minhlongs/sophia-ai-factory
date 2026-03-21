/**
 * POST /api/video/webhook
 *
 * HeyGen webhook handler for video completion events
 *
 * Flow:
 * 1. Verify webhook signature
 * 2. Parse event payload
 * 3. Update video_assets status
 * 4. Deduct MCU on success (with refund on failure)
 * 5. Return 200 OK
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/client";
import { verifyWebhookSignature } from "@/lib/video/heygen-client";
import { heygenWebhookSchema } from "@/lib/validators/video";

const HEYGEN_WEBHOOK_SECRET = process.env.HEYGEN_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    // 1. Verify webhook signature
    const signature = request.headers.get("x-heygen-signature") || "";
    const rawBody = await request.text();

    if (HEYGEN_WEBHOOK_SECRET) {
      const isValid = verifyWebhookSignature(
        rawBody,
        signature,
        HEYGEN_WEBHOOK_SECRET
      );

      if (!isValid) {
        console.error("Invalid HeyGen webhook signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    } else {
      console.warn("HEYGEN_WEBHOOK_SECRET not configured - skipping signature verification");
    }

    // 2. Parse and validate payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      console.error("Invalid JSON in webhook payload");
      return NextResponse.json(
        { error: "Invalid JSON" },
        { status: 400 }
      );
    }

    const validated = heygenWebhookSchema.safeParse(payload);

    if (!validated.success) {
      console.error("Invalid webhook payload:", validated.error.errors);
      return NextResponse.json(
        { error: "Invalid payload", details: validated.error.errors },
        { status: 400 }
      );
    }

    const { event, video_id, video_url, error_message } = validated.data;

    const serverClient = createServerClient();

    // 3. Find video asset by HeyGen video ID
    const { data: video } = await serverClient
      .from("video_assets")
      .select("id, org_id, status, mcu_cost, mcu_reserved")
      .eq("heygen_video_id", video_id)
      .single();

    if (!video) {
      console.warn("Webhook for unknown video:", video_id);
      return NextResponse.json({ success: true }); // Return 200 to avoid retries
    }

    // 4. Handle based on event type
    if (event === "task.completed") {
      // Video completed successfully — MCU was already reserved, mark as settled

      await serverClient
        .from("video_assets")
        .update({
          status: "ready",
          video_url: video_url,
          preview_url: video_url, // Use same URL if no separate preview
          ready_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          mcu_reserved: false, // Mark reservation as settled
        })
        .eq("id", video.id);

      console.log(`Video ${video.id} completed, MCU ${video.mcu_cost} already reserved`);
    } else if (event === "task.failed") {
      // Video generation failed — refund the MCU reservation

      await serverClient
        .from("video_assets")
        .update({
          status: "failed",
          error_message: error_message || "Video generation failed",
          updated_at: new Date().toISOString(),
          mcu_reserved: false,
        })
        .eq("id", video.id);

      // Refund reserved MCU since video failed
      if (video.mcu_reserved) {
        const { error: refundError } = await serverClient.rpc(
          "refund_mcu_reservation",
          { p_org_id: video.org_id, p_amount: video.mcu_cost }
        );

        if (refundError) {
          console.error("Failed to refund MCU for failed video:", video.id, refundError);
        } else {
          console.log(`Video ${video.id} failed — refunded ${video.mcu_cost} MCU to org ${video.org_id}`);
        }
      }
    }

    // 5. Return success
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error processing HeyGen webhook:", error);
    // Return 200 to avoid retry loops for unfixable errors
    return NextResponse.json({ success: true });
  }
}

/**
 * GET /api/video/webhook
 *
 * Health check endpoint for webhook verification
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    configured: !!process.env.HEYGEN_WEBHOOK_SECRET,
  });
}

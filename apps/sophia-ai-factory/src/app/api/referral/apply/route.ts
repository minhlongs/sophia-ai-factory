/**
 * POST /api/referral/apply
 * Apply a referral code during or after signup.
 * Validates the code exists, is not exhausted, then increments usage counter.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/lib/db/client";
import { getCurrentUserFromHeaders } from "@/lib/better-auth-session";

const applyBodySchema = z.object({
  code: z.string().min(1, "code is required").max(32),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = applyBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { code } = parsed.data;
    const db = createServerClient();

    // Fetch the referral code record
    const { data: referral, error: fetchError } = await db
      .from("referral_codes")
      .select("id, user_id, uses, max_uses, reward_amount")
      .eq("code", code)
      .single();

    if (fetchError || !referral) {
      return NextResponse.json({ error: "Referral code not found" }, { status: 404 });
    }

    // Prevent self-referral
    if (referral.user_id === user.id) {
      return NextResponse.json(
        { error: "You cannot apply your own referral code" },
        { status: 400 }
      );
    }

    // Check max_uses limit (null = unlimited)
    const currentUses = referral.uses ?? 0;
    const maxUses = referral.max_uses;
    if (maxUses !== null && currentUses >= maxUses) {
      return NextResponse.json(
        { error: "This referral code has reached its maximum usage limit" },
        { status: 410 }
      );
    }

    // Increment usage counter
    const { error: updateError } = await db
      .from("referral_codes")
      .update({ uses: currentUses + 1 })
      .eq("id", referral.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to apply referral code" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Referral code applied successfully",
      rewardAmount: referral.reward_amount ?? 0,
    });
  } catch (error) {
    console.error("[referral/apply] Unexpected error:", (error as Error).message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

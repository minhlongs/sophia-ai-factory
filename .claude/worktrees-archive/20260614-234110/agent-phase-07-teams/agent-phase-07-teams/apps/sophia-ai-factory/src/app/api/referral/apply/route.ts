/**
 * POST /api/referral/apply
 * Apply a referral code during or after signup.
 * Validates the code exists, is not exhausted, then increments usage counter.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerClient } from "@/seed/db/client";
import { getCurrentUserFromHeaders } from "@/seed/auth/better-auth-session";
import { logger } from "@/seed/utils/logger-utility";

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
    const { data: rawReferral, error: fetchError } = await db
      .from("referral_codes")
      .select("id, user_id, uses, max_uses, reward_amount")
      .eq("code", code)
      .single();
    const referral = rawReferral as { id: string; user_id: string; uses: number | null; max_uses: number | null; reward_amount: number | null } | null;

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
    if (maxUses !== null && maxUses !== undefined && currentUses >= maxUses) {
      return NextResponse.json(
        { error: "This referral code has reached its maximum usage limit" },
        { status: 410 }
      );
    }

    // Check if user already has a referrer
    const { data: existingProfile } = await db
      .from("user_profiles")
      .select("settings")
      .eq("user_id", user.id)
      .single();
    const existingSettings = existingProfile?.settings
      ? (typeof existingProfile.settings === 'string'
          ? JSON.parse(existingProfile.settings)
          : existingProfile.settings) as Record<string, unknown>
      : {};
    if (existingSettings.referred_by) {
      return NextResponse.json(
        { error: "You have already applied a referral code" },
        { status: 409 }
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

    // Store referred_by attribution in user_profiles settings
    const updatedSettings = {
      ...existingSettings,
      referred_by: referral.user_id,
      referral_code: code,
      referred_at: new Date().toISOString(),
    };
    if (existingProfile) {
      await db
        .from("user_profiles")
        .update({ settings: JSON.stringify(updatedSettings) })
        .eq("user_id", user.id);
    } else {
      await db
        .from("user_profiles")
        .insert({
          user_id: user.id,
          settings: JSON.stringify(updatedSettings),
        });
    }

    return NextResponse.json({
      success: true,
      message: "Referral code applied successfully",
      rewardAmount: referral.reward_amount ?? 0,
    });
  } catch (error) {
    logger.error("[referral/apply] Unexpected error", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

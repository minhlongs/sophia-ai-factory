/**
 * POST /api/referral/generate
 * Generate a unique referral code for the authenticated user.
 * Returns existing code if user already has one, otherwise creates new.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/seed/db/client";
import { getCurrentUserFromHeaders } from "@/seed/auth/better-auth-session";
import { logger } from "@/seed/utils/logger-utility";
import { REFERRAL_REWARD_CENTS } from "@/seed/config/tiers/tier-configs";

/** Generate a short alphanumeric referral code */
function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit ambiguous chars (0,O,1,I)
  let code = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (const byte of array) {
    code += chars[byte % chars.length];
  }
  return code;
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentUserFromHeaders(request.headers);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = createServerClient();

    // Return existing code if user already has one
    const { data: existing } = await db
      .from("referral_codes")
      .select("code, uses, reward_amount")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sophia.agencyos.network";
      return NextResponse.json({
        code: existing.code,
        shareUrl: `${baseUrl}/signup?ref=${existing.code}`,
        uses: existing.uses ?? 0,
        rewardAmount: existing.reward_amount ?? 0,
      });
    }

    // Generate a unique code (retry up to 5 times on collision)
    let code = "";
    let attempts = 0;
    while (attempts < 5) {
      const candidate = generateCode();
      const { data: collision } = await db
        .from("referral_codes")
        .select("id")
        .eq("code", candidate)
        .single();
      if (!collision) {
        code = candidate;
        break;
      }
      attempts++;
    }

    if (!code) {
      return NextResponse.json(
        { error: "Failed to generate unique referral code, please try again" },
        { status: 500 }
      );
    }

    // org_id is required by schema — use user.id as org_id for user-level codes
    const { data: created, error: insertError } = await db
      .from("referral_codes")
      .insert({
        org_id: user.id,
        user_id: user.id,
        code,
        uses: 0,
        max_uses: null,
        reward_amount: REFERRAL_REWARD_CENTS,
      })
      .select("code, uses, reward_amount")
      .single();

    if (insertError || !created) {
      return NextResponse.json(
        { error: "Failed to create referral code" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://sophia.agencyos.network";
    return NextResponse.json(
      {
        code: created.code,
        shareUrl: `${baseUrl}/signup?ref=${created.code}`,
        uses: created.uses ?? 0,
        rewardAmount: created.reward_amount ?? 0,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error("[referral/generate] Unexpected error", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

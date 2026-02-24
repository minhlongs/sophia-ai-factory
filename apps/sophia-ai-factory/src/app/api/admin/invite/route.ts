import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Tier } from "@/types";

export const dynamic = "force-dynamic";

const VALID_TIERS: Tier[] = ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"];

/**
 * Validate admin Basic Auth from request headers.
 */
function isAdminAuthorized(request: Request): boolean {
  const basicAuth = request.headers.get("authorization");
  if (!basicAuth) return false;

  try {
    const authValue = basicAuth.split(" ")[1];
    const [user, pwd] = atob(authValue).split(":");
    const validUser = process.env.ADMIN_USER;
    const validPass = process.env.ADMIN_PASS;
    if (!validUser || !validPass) return false;
    return user === validUser && pwd === validPass;
  } catch {
    return false;
  }
}

/**
 * POST /api/admin/invite
 * Body: { email: string, tier: "BASIC" | "PREMIUM" | "ENTERPRISE" }
 * Invites a user via Supabase Auth admin API with tier metadata.
 */
export async function POST(request: Request) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { email, tier } = body as { email?: string; tier?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, message: "Email is required" },
        { status: 400 }
      );
    }

    if (!tier || !VALID_TIERS.includes(tier as Tier)) {
      return NextResponse.json(
        { success: false, message: "Valid tier is required (BASIC, PREMIUM, ENTERPRISE)" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      { data: { tier } }
    );

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email} with ${tier} tier`,
      userId: data.user.id,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body" },
      { status: 400 }
    );
  }
}

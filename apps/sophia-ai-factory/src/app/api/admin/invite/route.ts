import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/db/client";
import { UNIFIED_TIERS } from "@/config/tiers";
import type { Tier } from "@/types";
import { withRateLimit } from '@/middleware/rate-limit-wrapper';

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
// Wrap handler with rate limiting (20 requests per minute for admin endpoints)
export const POST = withRateLimit(async function POST(request: Request) {
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

    // TIER CHECK: Team member limit for the target tier
    const teamLimit = UNIFIED_TIERS[tier as Tier].teamMembers;

    if (teamLimit < 999) {
      const db = createServerClient();
      const { data: members } = await db
        .from("users")
        .select("id");

      const memberCount = (members as { id: string }[] | null)?.length ?? 0;
      if (memberCount >= teamLimit) {
        return NextResponse.json(
          { success: false, message: `Team member limit reached (${teamLimit}). Upgrade for more.` },
          { status: 403 }
        );
      }
    }

    // NOTE: Supabase Auth admin.inviteUserByEmail removed in Better Auth + D1
    // migration. Re-implement via Better Auth invite flow when product needs it.
    return NextResponse.json(
      {
        success: false,
        message:
          "Admin invite is temporarily disabled — pending Better Auth invite implementation",
        email,
        tier,
      },
      { status: 501 }
    );
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid request body" },
      { status: 400 }
    );
  }
}, { addHeaders: true, config: { intervalMs: 60000, maxRequests: 10 } });

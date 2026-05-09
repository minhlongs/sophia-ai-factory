import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/seed/db/client";
import { UNIFIED_TIERS } from "@/seed/config/tiers";
import type { Tier } from "@/seed/types";
import { withRateLimit } from '@/forest/middleware/rate-limit-wrapper';
import { requireAdmin } from '@/seed/auth/require-admin';

export const dynamic = "force-dynamic";

const VALID_TIERS: Tier[] = ["BASIC", "PREMIUM", "ENTERPRISE", "MASTER"];

/**
 * POST /api/admin/invite
 * Body: { email: string, tier: "BASIC" | "PREMIUM" | "ENTERPRISE" }
 * Invites a user via Supabase Auth admin API with tier metadata.
 */
// Wrap handler with rate limiting (20 requests per minute for admin endpoints)
export const POST = withRateLimit(async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

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

    // NOTE: Supabase Auth admin.inviteUserByEmail was removed in Better Auth + D1
    // migration. Real Better Auth invite flow is tracked as a separate roadmap
    // item. Until then, return a structured 501 with workaround guidance the
    // operator UI can render as a friendly message instead of generic error.
    return NextResponse.json(
      {
        success: false,
        code: "INVITE_NOT_IMPLEMENTED",
        message:
          "Admin invite via email is not yet implemented. Workaround: ask the user to sign up at /login, then promote their tier via /api/admin/users.",
        workaround: {
          step1: "User self-registers at /login (Google/email).",
          step2: "Admin promotes tier via existing admin tools.",
        },
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

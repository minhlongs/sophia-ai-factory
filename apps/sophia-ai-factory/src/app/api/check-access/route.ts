import { NextRequest, NextResponse } from "next/server";
import { FeatureFlag, Tier } from "@/types";
import { checkTierAccess } from "@/lib/features";
import { tierGuard, LimitType } from "@/lib/tier-guard";
import { createClient } from "@/lib/supabase/server";
import { getUserTier } from "@/lib/subscription";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const feature = searchParams.get("feature") as FeatureFlag | null;
    const limitType = searchParams.get("limit") as LimitType | null;

    // Get user tier from auth session, fall back to query param for dev/testing
    let userTier: Tier = "BASIC";
    let userId = "mock-user-id";

    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        userId = user.id;
        userTier = await getUserTier(user.id);
      } else {
        // Fallback to query params for development/testing only
        const tierParam = searchParams.get("tier") as Tier | null;
        userTier = tierParam || "BASIC";
        userId = searchParams.get("userId") || "mock-user-id";
      }
    } catch {
      // Auth check failed - fall back to query params
      const tierParam = searchParams.get("tier") as Tier | null;
      userTier = tierParam || "BASIC";
      userId = searchParams.get("userId") || "mock-user-id";
    }

    if (limitType) {
      const limitCheck = await tierGuard.checkLimit(userId, limitType);
      if (!limitCheck.allowed) {
          return NextResponse.json({
              ...limitCheck,
              upgradeRequired: true,
              upgradeMessage: limitCheck.message
          }, { status: 403 });
      }
      return NextResponse.json(limitCheck);
    }

    if (feature) {
      const accessResult = checkTierAccess(userTier, feature);

      if (!accessResult.hasAccess) {
          return NextResponse.json({
              ...accessResult,
              upgradeRequired: true,
              upgradeMessage: `Upgrade to ${accessResult.requiredTier} to access this feature.`
          }, { status: 403 });
      }

      return NextResponse.json(accessResult);
    }

    return NextResponse.json(
      { error: "Missing feature or limit parameter" },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

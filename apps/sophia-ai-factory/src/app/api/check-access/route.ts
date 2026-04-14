import { NextRequest, NextResponse } from "next/server";
import { FeatureFlag, Tier } from "@/types";
import { checkTierAccess } from "@/lib/features";
import { tierGuard, LimitType } from "@/lib/tier-guard";
import { getUserTier } from "@/lib/db/get-user-tier";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const feature = searchParams.get("feature") as FeatureFlag | null;
    const limitType = searchParams.get("limit") as LimitType | null;

    // Get user tier from Better Auth session
    let userTier: Tier = "BASIC";
    let userId = "anonymous";

    try {
      const { getCurrentUserFromHeaders } = await import("@/lib/better-auth-session");
      const user = await getCurrentUserFromHeaders(request.headers);
      if (user) {
        userId = user.id;
        userTier = await getUserTier(userId);
      }
    } catch {
      // Auth failure defaults to BASIC tier
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
  } catch (e) {
    return NextResponse.json(
      { error: "Internal server error", detail: (e as Error).message },
      { status: 500 }
    );
  }
}

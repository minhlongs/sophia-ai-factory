import { NextRequest, NextResponse } from "next/server";
import { FeatureFlag, Tier } from "@/types";
import { checkTierAccess } from "@/lib/features";
import { tierGuard, LimitType } from "@/lib/tier-guard";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const feature = searchParams.get("feature") as FeatureFlag | null;
  const limitType = searchParams.get("limit") as LimitType | null;

  // TODO: In a real implementation, we would get the user's tier from the session/auth
  // For now, we'll check the 'tier' query param for testing, or default to BASIC
  const tierParam = searchParams.get("tier") as Tier | null;
  const userTier: Tier = tierParam || "BASIC";
  // Mock userId for limit checks if passed, or default to mock-user
  const userId = searchParams.get("userId") || "mock-user-id";

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
}

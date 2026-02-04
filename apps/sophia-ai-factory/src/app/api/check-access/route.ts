import { NextRequest, NextResponse } from "next/server";
import { FeatureFlag, Tier } from "@/types";
import { checkTierAccess } from "@/lib/features";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const feature = searchParams.get("feature") as FeatureFlag | null;

  if (!feature) {
    return NextResponse.json(
      { error: "Missing feature parameter" },
      { status: 400 }
    );
  }

  // TODO: In a real implementation, we would get the user's tier from the session/auth
  // For now, we'll check the 'tier' query param for testing, or default to BASIC
  const tierParam = searchParams.get("tier") as Tier | null;
  const userTier: Tier = tierParam || "BASIC";

  const accessResult = checkTierAccess(userTier, feature);

  if (!accessResult.hasAccess) {
    return NextResponse.json(accessResult, { status: 403 });
  }

  return NextResponse.json(accessResult);
}

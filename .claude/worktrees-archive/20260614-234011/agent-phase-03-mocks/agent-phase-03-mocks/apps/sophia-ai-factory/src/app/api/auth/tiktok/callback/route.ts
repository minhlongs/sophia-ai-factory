/**
 * Legacy TikTok OAuth callback.
 *
 * The active flow uses /api/oauth/tiktok/connect and /api/oauth/tiktok/callback,
 * which carry HMAC-signed state. Keep this route non-mutating so old callback URLs
 * cannot persist tokens without state verification.
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const dashboardUrl = new URL("/dashboard/settings", request.url);
  dashboardUrl.searchParams.set("error", "legacy_tiktok_oauth_disabled");
  return NextResponse.redirect(dashboardUrl.toString());
}

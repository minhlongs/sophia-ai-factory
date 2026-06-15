/**
 * Legacy YouTube OAuth callback.
 *
 * The active flow uses /api/oauth/youtube/connect and /api/oauth/youtube/callback,
 * which carry HMAC-signed state. Keep this route non-mutating so old callback URLs
 * cannot persist tokens without state verification.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const dashboardUrl = new URL("/dashboard/settings", request.url);
  dashboardUrl.searchParams.set("youtube_error", "legacy_oauth_disabled");
  return NextResponse.redirect(dashboardUrl.toString());
}

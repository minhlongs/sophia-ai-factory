/**
 * YouTube OAuth2 callback handler.
 * Receives the authorization code from Google, exchanges it for tokens,
 * and persists the refresh token in user_profiles.api_keys.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/seed/db/client";
import { getCurrentUser } from "@/seed/auth/better-auth-session";
import { exchangeCodeForTokens } from "@/land/youtube/youtube-oauth-client";
import { logger } from "@/seed/utils/logger-utility";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const dashboardUrl = new URL("/dashboard/settings", request.url);

  if (error) {
    logger.warn("YouTube OAuth denied by user", { error });
    dashboardUrl.searchParams.set("youtube_error", "access_denied");
    return NextResponse.redirect(dashboardUrl.toString());
  }

  if (!code) {
    logger.warn("YouTube OAuth callback missing code param");
    dashboardUrl.searchParams.set("youtube_error", "missing_code");
    return NextResponse.redirect(dashboardUrl.toString());
  }

  try {
    const user = await getCurrentUser();

    if (!user) {
      dashboardUrl.searchParams.set("youtube_error", "unauthorized");
      return NextResponse.redirect(dashboardUrl.toString());
    }

    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refresh_token) {
      logger.warn("YouTube token exchange returned no refresh_token", { userId: user.id });
      dashboardUrl.searchParams.set("youtube_error", "no_refresh_token");
      return NextResponse.redirect(dashboardUrl.toString());
    }

    const supabase = createServerClient();

    // Merge YouTube credentials into existing api_keys JSONB
    const { data: rawProfile } = await supabase
      .from("user_profiles")
      .select("api_keys")
      .eq("user_id", user.id)
      .single();
    const profile = rawProfile as { api_keys?: Record<string, unknown> } | null;
    const existingKeys = (profile?.api_keys as Record<string, unknown>) ?? {};
    const nowSec = Math.floor(Date.now() / 1000);

    const updatedKeys = {
      ...existingKeys,
      youtube: {
        refresh_token: tokens.refresh_token,
        access_token: tokens.access_token,
        expires_at: nowSec + tokens.expires_in,
      },
    };

    const { error: upsertError } = await supabase
      .from("user_profiles")
      .upsert({ user_id: user.id, api_keys: updatedKeys });

    if (upsertError) {
      logger.error("Failed to store YouTube tokens", new Error(upsertError.message), {
        userId: user.id,
      });
      dashboardUrl.searchParams.set("youtube_error", "storage_failed");
      return NextResponse.redirect(dashboardUrl.toString());
    }

    logger.info("YouTube account connected", { userId: user.id });
    dashboardUrl.searchParams.set("youtube_connected", "true");
    return NextResponse.redirect(dashboardUrl.toString());
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error("YouTube OAuth callback error", error);
    dashboardUrl.searchParams.set("youtube_error", "server_error");
    return NextResponse.redirect(dashboardUrl.toString());
  }
}

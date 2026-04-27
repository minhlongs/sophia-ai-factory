/**
 * GET /api/auth/tiktok/callback
 * TikTok OAuth2 callback handler.
 * Exchanges authorization code for tokens and stores them in user_profiles.api_keys.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/better-auth-session';
import { exchangeCodeForTokens } from '@/lib/tiktok/tiktok-oauth-client';
import { logger } from '@/lib/utils/logger-utility';
import { toError } from '@/lib/utils/to-error';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    logger.warn('TikTok callback: missing code param');
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=tiktok_missing_code', request.url),
    );
  }

  try {
    const user = await getCurrentUser();

    if (!user) {
      logger.warn('TikTok callback: unauthenticated request', { state });
      return NextResponse.redirect(
        new URL('/login?error=unauthenticated', request.url),
      );
    }

    const tokens = await exchangeCodeForTokens(code);
    const supabase = createServerClient();

    // Merge into existing api_keys JSONB to preserve other keys
    const { data: rawProfile } = await supabase
      .from('user_profiles')
      .select('api_keys')
      .eq('user_id', user.id)
      .single();
    const profile = rawProfile as { api_keys?: Record<string, unknown> } | null;

    const existingKeys = (profile?.api_keys ?? {}) as Record<string, unknown>;
    const updatedKeys = {
      ...existingKeys,
      tiktok_access_token: tokens.access_token,
      tiktok_refresh_token: tokens.refresh_token,
      tiktok_open_id: tokens.open_id,
      tiktok_token_expires_at: Date.now() + tokens.expires_in * 1000,
    };

    const { error: updateError } = await supabase
      .from('user_profiles')
      .upsert({ user_id: user.id, api_keys: updatedKeys, updated_at: new Date().toISOString() });

    if (updateError) {
      logger.error('TikTok callback: failed to store tokens', toError(updateError));
      return NextResponse.redirect(
        new URL('/dashboard/settings?error=tiktok_store_failed', request.url),
      );
    }

    logger.info('TikTok callback: tokens stored', { userId: user.id, openId: tokens.open_id });

    return NextResponse.redirect(
      new URL('/dashboard/settings?success=tiktok_connected', request.url),
    );
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logger.error('TikTok callback: unexpected error', error);
    return NextResponse.redirect(
      new URL('/dashboard/settings?error=tiktok_oauth_failed', request.url),
    );
  }
}

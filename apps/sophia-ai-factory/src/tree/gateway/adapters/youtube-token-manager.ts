/**
 * YouTube OAuth2 Credential & Access Token Lifecycle Helper
 *
 * Layer: tree/gateway/adapters
 */

import type { YouTubeOAuthClient } from '@/tree/types/oauth-client-types';
import { createServerClient } from '@/seed/db/client';

export const YOUTUBE_CHANNEL_ID = 'youtube';

/** Shape of YouTube credentials stored in user_profiles.api_keys */
export interface StoredYouTubeCredentials {
  refresh_token: string;
  access_token?: string;
  expires_at?: number;
}

/** Check if YouTube OAuth credentials are configured in the environment */
export function isYouTubeEnvConfigured(): boolean {
  return (
    !!process.env.YOUTUBE_CLIENT_ID &&
    !!process.env.YOUTUBE_CLIENT_SECRET &&
    !!process.env.YOUTUBE_REDIRECT_URI
  );
}

/** Retrieve a valid YouTube access token for a user, refreshing and persisting if expired */
export async function resolveYouTubeAccessToken(
  userId: string | undefined,
  oauthClient: YouTubeOAuthClient,
): Promise<string> {
  if (!userId) {
    throw new Error('No userId provided — cannot fetch YouTube credentials');
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('user_profiles')
    .select('api_keys')
    .eq('user_id', userId)
    .single();

  if (error || !data?.api_keys) {
    throw new Error('YouTube credentials not found in user profile');
  }

  const apiKeys = data.api_keys as Record<string, unknown>;
  const creds = apiKeys['youtube'] as StoredYouTubeCredentials | undefined;

  if (!creds?.refresh_token) {
    throw new Error('YouTube refresh token not found — user must reconnect');
  }

  // Check if stored access token is still valid (with 60s buffer)
  const nowSec = Math.floor(Date.now() / 1000);
  if (creds.access_token && creds.expires_at && creds.expires_at > nowSec + 60) {
    return creds.access_token;
  }

  // Refresh the access token
  const refreshed = await oauthClient.refreshAccessToken(creds.refresh_token);

  // Persist updated access token back to Supabase
  const updatedApiKeys = {
    ...apiKeys,
    youtube: {
      ...creds,
      access_token: refreshed.access_token,
      expires_at: nowSec + refreshed.expires_in,
    },
  };

  await db
    .from('user_profiles')
    .update({ api_keys: updatedApiKeys })
    .eq('user_id', userId);

  return refreshed.access_token;
}

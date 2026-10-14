import {
  shouldAllowRequest,
  recordSuccess,
  recordFailure,
} from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import {
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
  SCOPES,
  type YouTubeTokenResponse,
  type YouTubeRefreshResponse,
} from './types';
import { getCredentials, assertOk } from './credentials';

/** Build the Google OAuth2 authorization URL */
export function getAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/** Exchange an authorization code for access + refresh tokens */
export async function exchangeCodeForTokens(code: string): Promise<YouTubeTokenResponse> {
  if (!shouldAllowRequest('youtube')) {
    throw new Error('Circuit open for youtube — token exchange blocked');
  }
  const { clientId, clientSecret, redirectUri } = getCredentials();
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });
    await assertOk(res, 'YouTube token exchange');
    recordSuccess('youtube');
    return res.json() as Promise<YouTubeTokenResponse>;
  } catch (error) {
    recordFailure('youtube', classifyError(error));
    throw error;
  }
}

/** Refresh an expired access token using the stored refresh token */
export async function refreshAccessToken(refreshToken: string): Promise<YouTubeRefreshResponse> {
  if (!shouldAllowRequest('youtube')) {
    throw new Error('Circuit open for youtube — token refresh blocked');
  }
  const { clientId, clientSecret } = getCredentials();
  try {
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }).toString(),
    });
    await assertOk(res, 'YouTube token refresh');
    recordSuccess('youtube');
    return res.json() as Promise<YouTubeRefreshResponse>;
  } catch (error) {
    recordFailure('youtube', classifyError(error));
    throw error;
  }
}

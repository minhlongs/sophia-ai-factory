/**
 * X/Twitter OAuth 2.0 PKCE Helpers, Scopes & Types.
 *
 * Layer: forest/publishing
 *
 * @module forest/publishing/twitter-oauth-pkce
 */

const X_AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize';

export const TWITTER_SCOPES = [
  'tweet.read',
  'tweet.write',
  'users.read',
  'media.write',
  'offline.access',
];

export interface TwitterTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

export interface TwitterUserInfo {
  id: string;
  username: string;
  name: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/** Generate PKCE pair: code_verifier (43-128 chars) + code_challenge (S256). */
export async function generatePkce(): Promise<{ codeVerifier: string; codeChallenge: string }> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const codeVerifier = base64UrlEncode(verifierBytes);
  const challengeBuf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(challengeBuf));
  return { codeVerifier, codeChallenge };
}

export function getAuthorizationUrl(state: string, codeChallenge: string): string {
  const clientId = process.env.TWITTER_CLIENT_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!clientId || !appUrl) throw new Error('TWITTER_CLIENT_ID / NEXT_PUBLIC_APP_URL not set');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${appUrl}/api/oauth/twitter/callback`,
    scope: TWITTER_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${X_AUTHORIZE_URL}?${params.toString()}`;
}

export function basicAuthHeader(): string {
  const id = process.env.TWITTER_CLIENT_ID ?? '';
  const secret = process.env.TWITTER_CLIENT_SECRET ?? '';
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

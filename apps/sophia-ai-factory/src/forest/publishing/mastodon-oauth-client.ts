/**
 * Mastodon OAuth 2.0 helpers — instance-variable flow.
 * Each user may connect a different Mastodon instance (e.g., mastodon.social, hachyderm.io).
 * App registration is dynamic: /api/v1/apps per instance, credentials cached in env or per-request.
 * Tokens are instance-scoped — external_account_id stores "<instanceUrl>:<accountId>".
 */

import { logger } from '@/seed/utils/logger-utility';

export const MASTODON_SCOPES = 'read write';

export interface MastodonAppCredentials {
  client_id: string;
  client_secret: string;
  redirect_uri: string;
}

export interface MastodonTokenResponse {
  access_token: string;
  token_type?: string;
  scope?: string;
  created_at?: number;
}

export interface MastodonAccountInfo {
  id: string;
  username: string;
  acct: string;
  display_name?: string;
}

/** Register a new app on the Mastodon instance (one-time, but called per connect flow). */
export async function registerMastodonApp(instanceUrl: string): Promise<MastodonAppCredentials> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set');
  const normalizedInstance = instanceUrl.replace(/\/$/, '');
  const res = await fetch(`${normalizedInstance}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_name: 'Sophia AI Factory',
      redirect_uris: `${appUrl}/api/oauth/mastodon/callback`,
      scopes: MASTODON_SCOPES,
      website: appUrl,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch((err) => {
      logger.warn('Failed to read Mastodon app registration response', { error: String(err), context: 'registerApp' });
      return '';
    });
    throw new Error(`Mastodon app registration failed on ${normalizedInstance}: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { client_id?: string; client_secret?: string; redirect_uri?: string };
  if (!data.client_id || !data.client_secret) {
    throw new Error('Mastodon /api/v1/apps returned no client credentials');
  }
  return {
    client_id: data.client_id,
    client_secret: data.client_secret,
    redirect_uri: `${appUrl}/api/oauth/mastodon/callback`,
  };
}

export function getAuthorizationUrl(
  instanceUrl: string,
  clientId: string,
  state: string,
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL not set');
  const normalizedInstance = instanceUrl.replace(/\/$/, '');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl}/api/oauth/mastodon/callback`,
    response_type: 'code',
    scope: MASTODON_SCOPES,
    state,
  });
  return `${normalizedInstance}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  instanceUrl: string,
  clientId: string,
  clientSecret: string,
  code: string,
): Promise<MastodonTokenResponse> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const normalizedInstance = instanceUrl.replace(/\/$/, '');
  const res = await fetch(`${normalizedInstance}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${appUrl}/api/oauth/mastodon/callback`,
      grant_type: 'authorization_code',
      code,
      scope: MASTODON_SCOPES,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch((err) => {
      logger.warn('Failed to read Mastodon token exchange response', { error: String(err), context: 'exchangeCodeForTokens' });
      return '';
    });
    throw new Error(`Mastodon token exchange failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<MastodonTokenResponse>;
}

export async function getAccountInfo(instanceUrl: string, accessToken: string): Promise<MastodonAccountInfo> {
  const normalizedInstance = instanceUrl.replace(/\/$/, '');
  const res = await fetch(`${normalizedInstance}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    logger.error('[mastodon-oauth] getAccountInfo failed', new Error(`HTTP ${res.status}`));
    throw new Error(`Mastodon /verify_credentials failed: HTTP ${res.status}`);
  }
  const data = (await res.json()) as MastodonAccountInfo;
  if (!data.id) throw new Error('Mastodon /verify_credentials returned no id');
  return data;
}

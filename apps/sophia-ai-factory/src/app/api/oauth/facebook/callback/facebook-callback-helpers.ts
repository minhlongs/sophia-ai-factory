/**
 * OAuth state verification and channel upsert helpers for Facebook OAuth callback.
 * @module app/api/oauth/facebook/callback/facebook-callback-helpers
 */

import { createServerClient } from '@/seed/db/client';
import { encryptToken } from '@/tree/crypto/token-crypto';
import { randomUUID } from 'crypto';

const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export const FB_GRAPH = 'https://graph.facebook.com/v21.0';

export interface FBTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: { message: string };
}

export interface FBPage {
  id: string;
  name: string;
  access_token: string;
}

export interface FBAccountsResponse {
  data?: FBPage[];
}

function decodeBase64Url(str: string): string {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  return atob(pad ? padded + '='.repeat(4 - pad) : padded);
}

export async function verifyState(state: string): Promise<{ userId: string }> {
  const dotIdx = state.lastIndexOf('.');
  if (dotIdx === -1) throw new Error('Invalid state format');
  const payload = state.slice(0, dotIdx);
  const sig = state.slice(dotIdx + 1);
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error('OAUTH_STATE_SECRET not set');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBytes = Uint8Array.from(
    atob(sig.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0),
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes,
    new TextEncoder().encode(payload),
  );
  if (!valid) throw new Error('State signature invalid');
  const { userId, ts } = JSON.parse(decodeBase64Url(payload)) as { userId: string; ts: number };
  if (Date.now() - ts > STATE_MAX_AGE_MS) throw new Error('State expired');
  return { userId };
}

export async function upsertFacebookPublishingChannel(
  userId: string,
  page: FBPage,
): Promise<void> {
  // Page Access Tokens never expire when user is admin — store with expires_at=null.
  const encryptedPageToken = await encryptToken(page.access_token);
  const now = Math.floor(Date.now() / 1000);
  const db = createServerClient();
  const tenantId = userId;

  const { data: existing } = await db
    .from('publishing_channels')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('provider', 'facebook')
    .eq('external_account_id', page.id)
    .single();

  if (existing) {
    await db
      .from('publishing_channels')
      .update({
        access_token: encryptedPageToken,
        expires_at: null,
        status: 'active',
        display_name: page.name,
        updated_at: now,
      })
      .eq('id', (existing as { id: string }).id);
  } else {
    await db.from('publishing_channels').insert({
      id: randomUUID(),
      tenant_id: tenantId,
      user_id: userId,
      provider: 'facebook',
      external_account_id: page.id,
      display_name: page.name,
      access_token: encryptedPageToken,
      refresh_token: null,
      expires_at: null,
      status: 'active',
      created_at: now,
      updated_at: now,
    });
  }
}

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';
import { SERVICE_NAME, STATE_MAX_AGE_MS, type ZaloTokenResponse, type ZaloOAInfoResponse } from './types';

export function decodeBase64Url(str: string): string {
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
  if (!secret) throw new Error('OAUTH_STATE_SECRET is not set');

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const sigBytes = Uint8Array.from(atob(sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload));
  if (!valid) throw new Error('State signature invalid');

  const { userId, ts } = JSON.parse(decodeBase64Url(payload)) as { userId: string; ts: number };
  if (Date.now() - ts > STATE_MAX_AGE_MS) throw new Error('State expired');

  return { userId };
}

export async function exchangeZaloCode(code: string, redirectUri: string): Promise<ZaloTokenResponse> {
  if (!shouldAllowRequest(SERVICE_NAME)) throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  try {
    const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        secret_key: process.env.ZALO_APP_SECRET ?? '',
      },
      body: new URLSearchParams({
        app_id: process.env.ZALO_APP_ID ?? '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!res.ok) {
      recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
      logger.error('[Zalo Callback] Token exchange failed', new Error(`HTTP ${res.status}`));
      throw new Error(`Token exchange failed with HTTP ${res.status}`);
    }
    const data = (await res.json()) as ZaloTokenResponse;
    recordSuccess(SERVICE_NAME);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}

export async function fetchZaloOAInfo(accessToken: string): Promise<ZaloOAInfoResponse> {
  if (!shouldAllowRequest(SERVICE_NAME)) throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  try {
    const res = await fetch('https://openapi.zalo.me/v3/oa/getoa', {
      headers: { access_token: accessToken },
    });
    if (!res.ok) recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
    const data = (await res.json()) as ZaloOAInfoResponse;
    recordSuccess(SERVICE_NAME);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}

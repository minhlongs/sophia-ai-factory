import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';
import { SERVICE_NAME, STATE_MAX_AGE_MS, type LinkedInTokenResponse, type LinkedInProfileResponse } from './types';

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

export async function exchangeLinkedInCode(code: string, redirectUri: string): Promise<LinkedInTokenResponse> {
  if (!shouldAllowRequest(SERVICE_NAME)) throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  try {
    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: process.env.LINKEDIN_CLIENT_ID ?? '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET ?? '',
      }),
    });
    if (!res.ok) {
      recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
      logger.error('[LinkedIn Callback] Token exchange failed', new Error(`HTTP ${res.status}`));
      throw new Error(`Token exchange failed with HTTP ${res.status}`);
    }
    const data = (await res.json()) as LinkedInTokenResponse;
    recordSuccess(SERVICE_NAME);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}

export async function fetchLinkedInProfile(accessToken: string): Promise<LinkedInProfileResponse> {
  if (!shouldAllowRequest(SERVICE_NAME)) throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  try {
    const res = await fetch('https://api.linkedin.com/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}`, 'X-Restli-Protocol-Version': '2.0.0' },
    });
    if (!res.ok) {
      recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
      logger.error('[LinkedIn Callback] Profile fetch failed', new Error(`HTTP ${res.status}`));
      throw new Error(`Profile fetch failed with HTTP ${res.status}`);
    }
    const data = (await res.json()) as LinkedInProfileResponse;
    recordSuccess(SERVICE_NAME);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}

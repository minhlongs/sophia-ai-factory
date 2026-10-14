import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';
import {
  SERVICE_NAME,
  type ShortLivedTokenResponse,
  type LongLivedTokenResponse,
  type InstagramMeResponse,
} from './types';

export async function exchangeShortLivedToken(
  code: string,
  redirectUri: string,
): Promise<string> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let tokenData: ShortLivedTokenResponse;
  try {
    const tokenRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID ?? '',
        client_secret: process.env.INSTAGRAM_APP_SECRET ?? '',
        code,
        redirect_uri: redirectUri,
      }),
    });
    if (!tokenRes.ok) {
      const kind = classifyHttpStatus(tokenRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[Instagram Callback] Short-lived token exchange failed', new Error(`HTTP ${tokenRes.status}`));
      throw new Error('Token exchange failed');
    }
    tokenData = (await tokenRes.json()) as ShortLivedTokenResponse;
    recordSuccess(SERVICE_NAME);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }

  if (!tokenData.access_token) {
    throw new Error('No access token returned');
  }
  return tokenData.access_token;
}

export async function exchangeLongLivedToken(
  shortLivedToken: string,
): Promise<{ accessToken: string; expiresIn?: number }> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let longLivedData: LongLivedTokenResponse;
  try {
    const longLivedParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.INSTAGRAM_APP_ID ?? '',
      client_secret: process.env.INSTAGRAM_APP_SECRET ?? '',
      fb_exchange_token: shortLivedToken,
    });
    const longLivedRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?${longLivedParams.toString()}`,
    );
    if (!longLivedRes.ok) {
      const kind = classifyHttpStatus(longLivedRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[Instagram Callback] Long-lived token exchange failed', new Error(`HTTP ${longLivedRes.status}`));
      throw new Error('Long-lived token exchange failed');
    }
    longLivedData = (await longLivedRes.json()) as LongLivedTokenResponse;
    recordSuccess(SERVICE_NAME);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }

  if (!longLivedData.access_token) {
    throw new Error('No long-lived token returned');
  }
  return { accessToken: longLivedData.access_token, expiresIn: longLivedData.expires_in };
}

export async function fetchInstagramProfile(accessToken: string): Promise<InstagramMeResponse> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }
  let meData: InstagramMeResponse;
  try {
    const meRes = await fetch(
      `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${accessToken}`,
    );
    if (!meRes.ok) {
      const kind = classifyHttpStatus(meRes.status);
      recordFailure(SERVICE_NAME, kind);
      throw new Error('Failed to fetch Instagram account info');
    }
    meData = (await meRes.json()) as InstagramMeResponse;
    recordSuccess(SERVICE_NAME);
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }

  if (!meData.id) {
    throw new Error('Failed to fetch Instagram account info');
  }
  return meData;
}

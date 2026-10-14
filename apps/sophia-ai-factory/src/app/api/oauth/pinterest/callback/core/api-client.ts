import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import {
  SERVICE_NAME,
  PinterestTokenResponse,
  PinterestUserResponse,
  PinterestBoardResponse,
} from './types';

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
  clientId: string,
  clientSecret: string
): Promise<PinterestTokenResponse | null> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }

  try {
    const credentials = btoa(`${clientId}:${clientSecret}`);
    const tokenRes = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const kind = classifyHttpStatus(tokenRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[Pinterest Callback] Token exchange failed', new Error(`HTTP ${tokenRes.status}`));
      return null;
    }

    const data = (await tokenRes.json()) as PinterestTokenResponse;
    recordSuccess(SERVICE_NAME);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }
}

export async function fetchPinterestUserProfile(
  accessToken: string
): Promise<PinterestUserResponse | null> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }

  try {
    const meRes = await fetch('https://api.pinterest.com/v5/user_account', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!meRes.ok) {
      const kind = classifyHttpStatus(meRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[Pinterest Callback] User info fetch failed', new Error(`HTTP ${meRes.status}`));
      return null;
    }

    const data = (await meRes.json()) as PinterestUserResponse;
    recordSuccess(SERVICE_NAME);
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }
}

export async function fetchPinterestFirstBoard(
  accessToken: string
): Promise<{ id: string; name: string } | null> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[${SERVICE_NAME}] Circuit breaker open`);
  }

  try {
    const boardsRes = await fetch('https://api.pinterest.com/v5/boards?page_size=1', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!boardsRes.ok) {
      const kind = classifyHttpStatus(boardsRes.status);
      recordFailure(SERVICE_NAME, kind);
      logger.error('[Pinterest Callback] Boards fetch failed', new Error(`HTTP ${boardsRes.status}`));
      return null;
    }

    const data = (await boardsRes.json()) as PinterestBoardResponse;
    recordSuccess(SERVICE_NAME);
    return data.items?.[0] ?? null;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker open')) throw error;
    const kind = classifyError(error);
    recordFailure(SERVICE_NAME, kind);
    throw error;
  }
}

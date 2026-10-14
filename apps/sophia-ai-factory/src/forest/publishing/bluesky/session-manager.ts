/**
 * Bluesky AT Protocol Session Manager
 * Layer: FOREST (Infrastructure Orchestration)
 */

import { logger } from '@/seed/utils/logger-utility';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';
import { SERVICE_NAME, DEFAULT_PDS } from './types';

/** Create an AT Protocol session via app-password. Returns accessJwt, refreshJwt, did. */
export async function createAtprotoSession(
  identifier: string,
  appPassword: string,
  pdsUrl?: string,
): Promise<{ accessJwt: string; refreshJwt: string; did: string; handle: string }> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  }
  const base = (pdsUrl ?? process.env.BLUESKY_PDS_URL ?? DEFAULT_PDS).replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password: appPassword }),
    });
    if (!res.ok) {
      const body = await res.text().catch((err) => {
        logger.warn('Failed to read Bluesky createSession response', { error: String(err), context: 'createAtprotoSession' });
        return '';
      });
      recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
      throw new Error(`Bluesky createSession failed (${res.status}): ${body.slice(0, 200)}`);
    }
    recordSuccess(SERVICE_NAME);
    const data = (await res.json()) as {
      accessJwt?: string;
      refreshJwt?: string;
      did?: string;
      handle?: string;
      error?: string;
      message?: string;
    };
    if (!data.accessJwt || !data.did) {
      throw new Error(`Bluesky createSession returned no session: ${data.message ?? data.error ?? 'unknown'}`);
    }
    logger.info('[bluesky] Session created', { did: data.did });
    return {
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt ?? '',
      did: data.did,
      handle: data.handle ?? identifier,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('[circuit-breaker]')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}

/** Refresh an AT Protocol session using refreshJwt. */
export async function refreshAtprotoSession(
  refreshJwt: string,
  pdsUrl?: string,
): Promise<{ accessJwt: string; refreshJwt: string; did: string }> {
  if (!shouldAllowRequest(SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${SERVICE_NAME}`);
  }
  const base = (pdsUrl ?? process.env.BLUESKY_PDS_URL ?? DEFAULT_PDS).replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/xrpc/com.atproto.server.refreshSession`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${refreshJwt}` },
    });
    if (!res.ok) {
      const body = await res.text().catch((err) => {
        logger.warn('Failed to read Bluesky refreshSession response', { error: String(err), context: 'refreshAtprotoSession' });
        return '';
      });
      recordFailure(SERVICE_NAME, classifyHttpStatus(res.status));
      throw new Error(`Bluesky refreshSession failed (${res.status}): ${body.slice(0, 200)}`);
    }
    recordSuccess(SERVICE_NAME);
    const data = (await res.json()) as {
      accessJwt?: string;
      refreshJwt?: string;
      did?: string;
    };
    if (!data.accessJwt || !data.did) throw new Error('Bluesky refreshSession returned no tokens');
    return {
      accessJwt: data.accessJwt,
      refreshJwt: data.refreshJwt ?? refreshJwt,
      did: data.did,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes('[circuit-breaker]')) throw error;
    recordFailure(SERVICE_NAME, classifyError(error));
    throw error;
  }
}

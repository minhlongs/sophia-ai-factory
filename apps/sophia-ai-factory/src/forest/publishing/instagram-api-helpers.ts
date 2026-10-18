import type { PublishStatus } from './platform-adapter';
import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

export const IG_SERVICE_NAME = 'instagram-adapter' as const;
export const IG_API = 'https://graph.facebook.com/v19.0';

export async function pollInstagramContainerReady(containerId: string, token: string): Promise<void> {
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const statusRes = await fetch(
      `${IG_API}/${containerId}?fields=status_code&access_token=${token}`,
    );
    const statusData = (await statusRes.json()) as { status_code: string };
    if (statusData.status_code === 'FINISHED') {
      ready = true;
      break;
    }
    if (statusData.status_code === 'ERROR') {
      throw new Error('Instagram container processing failed');
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (!ready) throw new Error('Instagram container processing timeout');
}

export async function checkInstagramMediaStatus(
  accessToken: string,
  platformVideoId: string,
): Promise<{ status: PublishStatus; error?: string }> {
  if (!shouldAllowRequest(IG_SERVICE_NAME)) {
    return { status: 'failed', error: `[circuit-breaker] Circuit open for ${IG_SERVICE_NAME}` };
  }
  const token = accessToken.includes(':') ? accessToken.split(':', 2)[1] : accessToken;

  try {
    const res = await fetch(
      `${IG_API}/${platformVideoId}?fields=status_code,timestamp&access_token=${token}`,
    );

    if (!res.ok) {
      recordFailure(IG_SERVICE_NAME, classifyHttpStatus(res.status));
      return { status: 'failed', error: `Instagram API ${res.status}` };
    }

    recordSuccess(IG_SERVICE_NAME);
    const data = (await res.json()) as { status_code?: string };

    if (data.status_code === 'FINISHED' || !data.status_code) return { status: 'published' };
    if (data.status_code === 'ERROR') return { status: 'failed', error: 'Media processing error' };
    return { status: 'processing' };
  } catch (error) {
    recordFailure(IG_SERVICE_NAME, classifyError(error));
    return { status: 'failed', error: classifyError(error) as string };
  }
}

export async function refreshInstagramAccessToken(
  clientId: string,
  _clientSecret: string,
  refreshToken: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  if (!shouldAllowRequest(IG_SERVICE_NAME)) {
    throw new Error(`[circuit-breaker] Circuit open for ${IG_SERVICE_NAME}`);
  }
  try {
    const res = await fetch(
      `${IG_API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${clientId}&fb_exchange_token=${refreshToken}`,
    );

    if (!res.ok) {
      const err = await res.text();
      recordFailure(IG_SERVICE_NAME, classifyHttpStatus(res.status));
      throw new Error(`Instagram token refresh failed: ${res.status} ${err}`);
    }

    recordSuccess(IG_SERVICE_NAME);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure(IG_SERVICE_NAME, classifyError(error));
    throw error;
  }
}

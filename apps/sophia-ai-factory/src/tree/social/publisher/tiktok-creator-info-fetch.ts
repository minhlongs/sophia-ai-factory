/**
 * TikTok Creator Preflight — Fetcher
 *
 * Asks TikTok what this creator may publish with. Wrapped in the circuit
 * breaker because it is a real outbound HTTP call on the publish path.
 *
 * Layer: tree (domain reusable logic — imports seed only)
 * @module tree/social/publisher/tiktok-creator-info-fetch
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, FailureKind } from '@/seed/types/failure-kind';
import {
  CreatorInfoUnavailableError,
  parseCreatorInfoResponse,
  type TikTokCreatorCapabilities,
} from './tiktok-creator-info-types';

export const TIKTOK_CREATOR_INFO_ENDPOINT = 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/';

/**
 * Ask TikTok what this creator may publish with. A non-2xx answer, a transport
 * failure and a body that cannot be parsed into capabilities all throw the same
 * refusal, so no caller can mistake an unanswered question for a permission.
 */
export async function fetchTikTokCreatorInfo(
  accessToken: string,
  fetchImpl: typeof fetch = globalThis.fetch as typeof fetch,
): Promise<TikTokCreatorCapabilities> {
  if (!shouldAllowRequest('tiktok')) {
    throw new CreatorInfoUnavailableError('circuit breaker open for tiktok');
  }

  try {
    const res = await fetchImpl(TIKTOK_CREATOR_INFO_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      recordFailure('tiktok', classifyError(new Error(`HTTP ${res.status}`)));
      throw new CreatorInfoUnavailableError(`tiktok answered HTTP ${res.status}`, { status: res.status });
    }

    const payload = (await res.json()) as unknown;
    const capabilities = parseCreatorInfoResponse(payload);
    recordSuccess('tiktok');
    return capabilities;
  } catch (err: unknown) {
    if (err instanceof CreatorInfoUnavailableError) throw err;
    recordFailure('tiktok', classifyError(err));
    throw err;
  }
}

export { FailureKind };

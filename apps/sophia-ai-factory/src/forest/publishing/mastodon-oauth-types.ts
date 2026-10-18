/**
 * Mastodon OAuth 2.0 constants, response types, and account verification helper.
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError, classifyHttpStatus } from '@/seed/types/failure-kind';

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

export async function getAccountInfo(
  instanceUrl: string,
  accessToken: string,
): Promise<MastodonAccountInfo> {
  if (!shouldAllowRequest('mastodon')) {
    throw new Error('[Mastodon] Circuit breaker open for mastodon');
  }
  const normalizedInstance = instanceUrl.replace(/\/$/, '');
  try {
    const res = await fetch(`${normalizedInstance}/api/v1/accounts/verify_credentials`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      recordFailure('mastodon', classifyHttpStatus(res.status));
      throw new Error(`Mastodon /verify_credentials failed: HTTP ${res.status}`);
    }
    recordSuccess('mastodon');
    const data = (await res.json()) as MastodonAccountInfo;
    if (!data.id) throw new Error('Mastodon /verify_credentials returned no id');
    return data;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Circuit breaker')) throw error;
    recordFailure('mastodon', classifyError(error));
    throw error;
  }
}

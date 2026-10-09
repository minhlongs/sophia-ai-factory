/**
 * @file cloudflare-saas-client.ts
 * @description Cloudflare Custom Hostname API client for SaaS verification.
 * @layer tree
 */

import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { success, failure, type Result } from '@/seed/types/result';
import type {
  CloudflareCustomHostnameResult,
  CloudflareApiResponse,
  CustomDomainError,
} from '@/seed/types/custom-domains';
import {
  getCloudflareCredentials,
  buildMockCreatedHostname,
  buildMockFetchedHostname,
} from './cloudflare-credentials';

export { getCloudflareCredentials };

export async function createCloudflareCustomHostname(
  hostname: string,
): Promise<Result<CloudflareCustomHostnameResult, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Operating in mock mode (credentials absent)', { hostname });
    return success(buildMockCreatedHostname(hostname));
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hostname,
        ssl: {
          method: 'txt',
          type: 'dv',
          settings: {
            min_tls_version: '1.2',
            http2: 'on',
          },
        },
      }),
    });

    const data = (await res.json()) as CloudflareApiResponse<CloudflareCustomHostnameResult>;
    if (!res.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message ?? `HTTP ${res.status}: Cloudflare creation failed`;
      return failure({
        code: 'CLOUDFLARE_ERROR',
        message: errorMsg,
        details: data.errors,
      });
    }

    return success(data.result);
  } catch (err) {
    const error = toError(err);
    logger.error('[CloudflareSaaS] createCustomHostname request failed', error);
    return failure({ code: 'CLOUDFLARE_ERROR', message: error.message });
  }
}

export async function fetchCloudflareCustomHostname(
  cfCustomHostnameId: string,
  hostname: string,
): Promise<Result<CloudflareCustomHostnameResult, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Mock status check', { cfCustomHostnameId, hostname });
    return success(buildMockFetchedHostname(hostname, cfCustomHostnameId));
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfCustomHostnameId}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await res.json()) as CloudflareApiResponse<CloudflareCustomHostnameResult>;
    if (!res.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message ?? `HTTP ${res.status}: Cloudflare status check failed`;
      return failure({
        code: 'CLOUDFLARE_ERROR',
        message: errorMsg,
        details: data.errors,
      });
    }

    return success(data.result);
  } catch (err) {
    const error = toError(err);
    logger.error('[CloudflareSaaS] fetchCustomHostname request failed', error);
    return failure({ code: 'CLOUDFLARE_ERROR', message: error.message });
  }
}

export async function deleteCloudflareCustomHostname(
  cfCustomHostnameId: string,
): Promise<Result<{ id: string }, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Mock deletion', { cfCustomHostnameId });
    return success({ id: cfCustomHostnameId });
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfCustomHostnameId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = (await res.json()) as CloudflareApiResponse<{ id: string }>;
    if (!res.ok || !data.success) {
      const errorMsg = data.errors?.[0]?.message ?? `HTTP ${res.status}: Cloudflare deletion failed`;
      return failure({
        code: 'CLOUDFLARE_ERROR',
        message: errorMsg,
        details: data.errors,
      });
    }

    return success(data.result);
  } catch (err) {
    const error = toError(err);
    logger.error('[CloudflareSaaS] deleteCustomHostname request failed', error);
    return failure({ code: 'CLOUDFLARE_ERROR', message: error.message });
  }
}

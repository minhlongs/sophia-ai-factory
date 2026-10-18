/**
 * @file cloudflare-saas-client.ts
 * @description Cloudflare Custom Hostname API client for SaaS verification.
 * @layer tree
 */

import { logger } from '@/seed/utils/logger-utility';
import { success, type Result } from '@/seed/types/result';
import type {
  CloudflareCustomHostnameResult,
  CustomDomainError,
} from '@/seed/types/custom-domains';
import {
  getCloudflareCredentials,
  buildMockCreatedHostname,
  buildMockFetchedHostname,
} from './cloudflare-credentials';
import { executeCloudflareCustomHostnameRequest } from './cloudflare-saas-http';

export { getCloudflareCredentials };

export async function createCloudflareCustomHostname(
  hostname: string,
): Promise<Result<CloudflareCustomHostnameResult, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Operating in mock mode (credentials absent)', { hostname });
    return success(buildMockCreatedHostname(hostname));
  }

  return executeCloudflareCustomHostnameRequest<CloudflareCustomHostnameResult>({
    url: `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
    method: 'POST',
    apiToken,
    body: {
      hostname,
      ssl: {
        method: 'txt',
        type: 'dv',
        settings: {
          min_tls_version: '1.2',
          http2: 'on',
        },
      },
    },
    fallbackErrorLabel: 'Cloudflare creation failed',
    operationLogName: 'createCustomHostname',
  });
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

  return executeCloudflareCustomHostnameRequest<CloudflareCustomHostnameResult>({
    url: `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfCustomHostnameId}`,
    method: 'GET',
    apiToken,
    fallbackErrorLabel: 'Cloudflare status check failed',
    operationLogName: 'fetchCustomHostname',
  });
}

export async function deleteCloudflareCustomHostname(
  cfCustomHostnameId: string,
): Promise<Result<{ id: string }, CustomDomainError>> {
  const { zoneId, apiToken } = getCloudflareCredentials();

  if (!zoneId || !apiToken) {
    logger.info('[CloudflareSaaS] Mock deletion', { cfCustomHostnameId });
    return success({ id: cfCustomHostnameId });
  }

  return executeCloudflareCustomHostnameRequest<{ id: string }>({
    url: `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfCustomHostnameId}`,
    method: 'DELETE',
    apiToken,
    fallbackErrorLabel: 'Cloudflare deletion failed',
    operationLogName: 'deleteCustomHostname',
  });
}

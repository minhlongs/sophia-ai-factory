/**
 * @file cloudflare-credentials.ts
 * @description Cloudflare API credentials resolver and mock fixtures for test environments.
 * @layer tree
 */

import type { CloudflareCustomHostnameResult } from '@/seed/types/custom-domains';

export function getCloudflareCredentials(): { zoneId: string | null; apiToken: string | null } {
  const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
  const ctx = (globalThis as Record<symbol, { env?: Record<string, unknown> }>)[Symbol.for('__cloudflare-context__')];

  const zoneId = (process.env.CLOUDFLARE_ZONE_ID || env?.CLOUDFLARE_ZONE_ID || ctx?.env?.CLOUDFLARE_ZONE_ID) as string | undefined;
  const apiToken = (process.env.CLOUDFLARE_API_TOKEN || env?.CLOUDFLARE_API_TOKEN || ctx?.env?.CLOUDFLARE_API_TOKEN) as string | undefined;

  return {
    zoneId: zoneId ?? null,
    apiToken: apiToken ?? null,
  };
}

export function buildMockCreatedHostname(hostname: string): CloudflareCustomHostnameResult {
  const mockId = 'mock_cf_' + Math.random().toString(36).substring(2, 15);
  return {
    id: mockId,
    hostname,
    status: 'pending',
    verification_errors: [],
    ownership_verification: {
      type: 'txt',
      name: `_cf-custom-hostname.${hostname}`,
      value: `mock_ownership_${mockId}`,
    },
    ssl: {
      id: mockId,
      type: 'dv',
      method: 'txt',
      status: 'pending_validation',
      txt_name: `_acme-challenge.${hostname}`,
      txt_value: `mock_dcv_${mockId}`,
      validation_records: [
        {
          status: 'pending',
          txt_name: `_acme-challenge.${hostname}`,
          txt_value: `mock_dcv_${mockId}`,
        },
      ],
    },
  };
}

export function buildMockFetchedHostname(
  hostname: string,
  cfCustomHostnameId: string,
): CloudflareCustomHostnameResult {
  const isMockActive = hostname.includes('active-test');
  const isMockError = hostname.includes('error-test');

  return {
    id: cfCustomHostnameId,
    hostname,
    status: isMockActive ? 'active' : isMockError ? 'blocked' : 'pending',
    verification_errors: isMockError ? ['CA verification timeout'] : [],
    ownership_verification: {
      type: 'txt',
      name: `_cf-custom-hostname.${hostname}`,
      value: 'mock_ownership_verified',
    },
    ssl: {
      id: cfCustomHostnameId,
      type: 'dv',
      method: 'txt',
      status: isMockActive ? 'active' : isMockError ? 'error' : 'pending_validation',
      txt_name: `_acme-challenge.${hostname}`,
      txt_value: 'mock_dcv_token',
    },
  };
}

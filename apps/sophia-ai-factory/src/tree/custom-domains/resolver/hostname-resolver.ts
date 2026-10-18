/**
 * Hostname Routing State Coordinator and D1 Resolution Service
 *
 * Queries Cloudflare D1 custom_domains and agy_tenant_configs tables
 * with in-memory edge caching.
 *
 * @module tree/custom-domains/resolver/hostname-resolver
 */

import { resolveAgencySlugFromHostname } from '@/tree/agy/domain-router';
import type { TenantHostnameContext } from './types';
import { normalizeHostname, isInternalOrCanonicalHostname } from './hostname-utils';
import { getCachedContext } from './domain-cache';
import {
  queryAgencySubdomainContext,
  queryCustomDomainContext,
} from './hostname-d1-queries';

/**
 * Resolves custom hostname against active custom_domains table in D1.
 * Applies in-memory edge caching to prevent D1 contention.
 */
export async function resolveTenantFromHostname(
  db: D1Database | null,
  rawHost: string | null | undefined,
): Promise<TenantHostnameContext> {
  const hostname = normalizeHostname(rawHost);

  // 1. Check canonical / internal domains
  if (!hostname || isInternalOrCanonicalHostname(hostname)) {
    return {
      isInternal: true,
      isCustomDomain: false,
      tenantOrgId: null,
      customDomain: null,
      whitelabelActive: false,
      sslStatus: null,
    };
  }

  // 2. Check isolate in-memory cache
  const cachedContext = getCachedContext(hostname);
  if (cachedContext) {
    return cachedContext;
  }

  // 3. Fallback when D1 database is unavailable (e.g. build step or early init)
  if (!db) {
    return {
      isInternal: false,
      isCustomDomain: true,
      tenantOrgId: null,
      customDomain: hostname,
      whitelabelActive: false,
      sslStatus: null,
    };
  }

  // 4. Check agency subdomain lookup first
  const agencySlug = resolveAgencySlugFromHostname(hostname);
  if (agencySlug) {
    const agyContext = await queryAgencySubdomainContext(db, hostname, agencySlug);
    if (agyContext) {
      return agyContext;
    }
  }

  // 5. Query D1 custom_domains database
  return queryCustomDomainContext(db, hostname, agencySlug);
}

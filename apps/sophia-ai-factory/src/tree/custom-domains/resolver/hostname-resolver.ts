/**
 * Hostname Routing State Coordinator and D1 Resolution Service
 *
 * Queries Cloudflare D1 custom_domains and agy_tenant_configs tables
 * with in-memory edge caching.
 *
 * @module tree/custom-domains/resolver/hostname-resolver
 */

import { logger } from '@/seed/utils/logger-utility';
import { resolveAgencySlugFromHostname } from '@/tree/agy/domain-router';
import type { TenantHostnameContext } from './types';
import { normalizeHostname, isInternalOrCanonicalHostname } from './hostname-utils';
import {
  getCachedContext,
  setInCache,
  CACHE_TTL_MS,
  NEGATIVE_CACHE_TTL_MS,
} from './domain-cache';

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
    const unverifiedContext: TenantHostnameContext = {
      isInternal: false,
      isCustomDomain: true,
      tenantOrgId: null,
      customDomain: hostname,
      whitelabelActive: false,
      sslStatus: null,
    };
    return unverifiedContext;
  }

  // 4. Check agency subdomain lookup first
  const agencySlug = resolveAgencySlugFromHostname(hostname);
  if (agencySlug) {
    try {
      const agyRow = await db
        .prepare(
          `SELECT agency_id, org_id, agency_slug, status
           FROM agy_tenant_configs
           WHERE agency_slug = ?1 AND status = 'active'
           LIMIT 1`
        )
        .bind(agencySlug)
        .first<{
          agency_id: string;
          org_id: string;
          agency_slug: string;
          status: string;
        }>();

      if (agyRow && (agyRow.org_id || agyRow.agency_id)) {
        const context: TenantHostnameContext = {
          isInternal: false,
          isCustomDomain: false,
          isAgencySubdomain: true,
          agencySlug: agyRow.agency_slug,
          agencyId: agyRow.agency_id,
          tenantOrgId: agyRow.org_id || agyRow.agency_id,
          customDomain: null,
          whitelabelActive: agyRow.status === 'active',
          sslStatus: 'active',
        };
        setInCache(hostname, context, CACHE_TTL_MS);
        return context;
      }
    } catch (err) {
      logger.warn('[hostname-resolver] Error resolving agency slug in D1', {
        agencySlug,
        error: String(err),
      });
    }
  }

  // 5. Query D1 custom_domains database
  try {
    const row = await db
      .prepare(
        `SELECT org_id, hostname, active, ssl_status
         FROM custom_domains
         WHERE hostname = ?1 AND active = 1
         LIMIT 1`
      )
      .bind(hostname)
      .first<{
        org_id: string;
        hostname: string;
        active: number;
        ssl_status: string;
      }>();

    if (row && row.org_id) {
      const isSslActive = row.ssl_status === 'active';
      const context: TenantHostnameContext = {
        isInternal: false,
        isCustomDomain: true,
        tenantOrgId: row.org_id,
        customDomain: row.hostname,
        whitelabelActive: row.active === 1 && isSslActive,
        sslStatus: (row.ssl_status as TenantHostnameContext['sslStatus']) ?? 'pending_validation',
      };

      setInCache(hostname, context, CACHE_TTL_MS);
      return context;
    }

    // 6. Hostname not found in custom_domains table (negative cache)
    const notFoundContext: TenantHostnameContext = {
      isInternal: false,
      isCustomDomain: !agencySlug,
      isAgencySubdomain: !!agencySlug,
      agencySlug: agencySlug ?? null,
      tenantOrgId: null,
      customDomain: hostname,
      whitelabelActive: false,
      sslStatus: null,
    };

    setInCache(hostname, notFoundContext, NEGATIVE_CACHE_TTL_MS);
    return notFoundContext;
  } catch (err) {
    logger.warn('[hostname-resolver] Error resolving hostname in D1', {
      hostname,
      error: String(err),
    });

    return {
      isInternal: false,
      isCustomDomain: true,
      tenantOrgId: null,
      customDomain: hostname,
      whitelabelActive: false,
      sslStatus: null,
    };
  }
}

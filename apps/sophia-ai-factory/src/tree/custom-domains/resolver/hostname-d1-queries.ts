/**
 * D1 Hostname Resolution Queries for Agency Subdomains and Custom Domains
 *
 * @module tree/custom-domains/resolver/hostname-d1-queries
 */

import { logger } from '@/seed/utils/logger-utility';
import type { TenantHostnameContext } from './types';
import {
  setInCache,
  CACHE_TTL_MS,
  NEGATIVE_CACHE_TTL_MS,
} from './domain-cache';

export async function queryAgencySubdomainContext(
  db: D1Database,
  hostname: string,
  agencySlug: string,
): Promise<TenantHostnameContext | null> {
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
  return null;
}

export async function queryCustomDomainContext(
  db: D1Database,
  hostname: string,
  agencySlug: string | null,
): Promise<TenantHostnameContext> {
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

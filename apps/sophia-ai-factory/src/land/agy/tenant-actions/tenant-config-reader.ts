/**
 * Agency Tenant Row Mapper & Config Retrieval
 *
 * @module land/agy/tenant-actions/tenant-config-reader
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type { AgencyTenantConfig } from '@/seed/types/agy-multitenancy';

interface AgencyTenantRow {
  agency_id: string;
  org_id: string;
  agency_slug: string;
  custom_domain: string | null;
  status: string;
  quota_limit_mcu: number;
  quota_used_mcu: number;
  rate_limit_rps: number;
  created_at: number;
  updated_at: number;
}

export function mapAgencyTenantRow(row: AgencyTenantRow): AgencyTenantConfig {
  return {
    agencyId: row.agency_id,
    orgId: row.org_id,
    agencySlug: row.agency_slug,
    customDomain: row.custom_domain,
    status: row.status as AgencyTenantConfig['status'],
    quotaLimitMcu: row.quota_limit_mcu,
    quotaUsedMcu: row.quota_used_mcu,
    rateLimitRps: row.rate_limit_rps,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    agency_id: row.agency_id,
    org_id: row.org_id,
    agency_slug: row.agency_slug,
    custom_domain: row.custom_domain,
    quota_limit_mcu: row.quota_limit_mcu,
    quota_used_mcu: row.quota_used_mcu,
    rate_limit_rps: row.rate_limit_rps,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Retrieves agency tenant config by ID or slug.
 */
export async function getAgencyTenantConfig(agencyIdOrSlug: string): Promise<AgencyTenantConfig | null> {
  const db = createServerClient();

  try {
    const row = await db
      .prepare(
        `SELECT agency_id, org_id, agency_slug, custom_domain, status,
                quota_limit_mcu, quota_used_mcu, rate_limit_rps, created_at, updated_at
         FROM agy_tenant_configs
         WHERE agency_id = ?1 OR agency_slug = ?1
         LIMIT 1`
      )
      .bind(agencyIdOrSlug)
      .first<AgencyTenantRow>();

    if (!row) return null;
    return mapAgencyTenantRow(row);
  } catch (err) {
    logger.warn('[AGY Actions] getAgencyTenantConfig failed', { agencyIdOrSlug, error: String(err) });
    return null;
  }
}

/**
 * Agency Tenant & Domain Registration
 *
 * @module land/agy/tenant-actions/tenant-registrar
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { isValidAgencySlug, normalizeHostname } from '@/tree/agy/domain-router';
import type { RegisterAgencyInput, RegisterDomainInput } from './types';
import { recordAuditLog } from './audit-logger';

export { getAgencyTenantConfig } from './tenant-config-reader';

/**
 * Registers a new agency tenant configuration.
 */
export async function registerAgencyTenant(input: RegisterAgencyInput): Promise<{
  success: boolean;
  agencyId?: string;
  error?: string;
}> {
  const { orgId, agencySlug, customDomain, quotaLimitMcu = 100000, rateLimitRps = 100, actorId } = input;

  if (!orgId) {
    return { success: false, error: 'orgId is required' };
  }
  if (!isValidAgencySlug(agencySlug)) {
    return { success: false, error: `Invalid or reserved agency slug: "${agencySlug}"` };
  }

  const db = createServerClient();
  const normalizedDomain = customDomain ? normalizeHostname(customDomain) : null;
  const now = Math.floor(Date.now() / 1000);
  const agencyId = `agy_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;

  try {
    await db
      .prepare(
        `INSERT INTO agy_tenant_configs (
           agency_id, org_id, agency_slug, custom_domain, status,
           quota_limit_mcu, quota_used_mcu, rate_limit_rps, created_at, updated_at
         ) VALUES (?1, ?2, ?3, ?4, 'active', ?5, 0, ?6, ?7, ?8)`
      )
      .bind(
        agencyId,
        orgId,
        agencySlug.toLowerCase().trim(),
        normalizedDomain,
        quotaLimitMcu,
        rateLimitRps,
        now,
        now
      )
      .run();

    await recordAuditLog(agencyId, 'AGENCY_REGISTERED', `agency:${agencyId}`, {
      orgId,
      agencySlug,
      customDomain: normalizedDomain,
      quotaLimitMcu,
    }, actorId);

    return { success: true, agencyId };
  } catch (err) {
    logger.error('[AGY Actions] registerAgencyTenant failed', err instanceof Error ? err : new Error(String(err)));
    return { success: false, error: String(err) };
  }
}

/**
 * Registers an agency domain (subdomain or verified custom domain).
 */
export async function registerAgencyDomain(input: RegisterDomainInput): Promise<{
  success: boolean;
  domainId?: string;
  error?: string;
}> {
  const { agencyId, domain, domainType = 'custom', isPrimary = false, actorId } = input;
  const normalizedDomain = normalizeHostname(domain);

  if (!agencyId || !normalizedDomain) {
    return { success: false, error: 'agencyId and domain are required' };
  }

  const db = createServerClient();
  const now = Math.floor(Date.now() / 1000);
  const domainId = `dom_${Date.now()}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
  const verificationToken = `agy_verify_${crypto.randomUUID().replace(/-/g, '')}`;

  try {
    await db
      .prepare(
        `INSERT INTO agy_agency_domains (
           id, agency_id, domain, domain_type, ssl_status, verification_token, is_primary, created_at
         ) VALUES (?1, ?2, ?3, ?4, 'pending', ?5, ?6, ?7)`
      )
      .bind(
        domainId,
        agencyId,
        normalizedDomain,
        domainType,
        verificationToken,
        isPrimary ? 1 : 0,
        now
      )
      .run();

    await recordAuditLog(agencyId, 'DOMAIN_REGISTERED', `domain:${normalizedDomain}`, {
      domainId,
      domainType,
      isPrimary,
    }, actorId);

    return { success: true, domainId };
  } catch (err) {
    logger.error('[AGY Actions] registerAgencyDomain failed', err instanceof Error ? err : new Error(String(err)));
    return { success: false, error: String(err) };
  }
}

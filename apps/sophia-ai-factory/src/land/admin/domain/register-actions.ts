'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  CustomDomainRecord,
  CustomDomainError,
} from '@/seed/types/custom-domains';
import {
  createCloudflareCustomHostname,
  parseOwnershipVerification,
  parseSslDcvVerification,
  evaluateStatusTransitions,
  getCustomDomainById,
  getCustomDomainByHostname,
  listCustomDomainsByOrg,
  DEFAULT_CNAME_TARGET,
  validateHostname,
} from '@/tree/custom-domains/verification-service';
import { invalidateTenantBrandingCache } from '@/tree/branding/org-branding-repo';
import { assertMasterTierAndOrgAccess } from './domain-access';

/**
 * Register a new custom domain for an organization (MASTER tier only).
 */
export async function registerCustomDomainAction(
  orgId: string,
  rawHostname: string,
): Promise<Result<CustomDomainRecord, CustomDomainError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database unavailable' });
    }

    const hostValidation = validateHostname(rawHostname);
    if (!hostValidation.ok) return hostValidation;
    const hostname = hostValidation.value;

    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) return auth;

    const existing = await getCustomDomainByHostname(db, hostname);
    if (existing) {
      return failure({
        code: 'CONFLICT',
        message: `Hostname '${hostname}' is already registered`,
      });
    }

    const cfResult = await createCloudflareCustomHostname(hostname);
    if (!cfResult.ok) return cfResult;

    const cfData = cfResult.value;
    const ownership = parseOwnershipVerification(cfData);
    const sslDcv = parseSslDcvVerification(cfData);
    const { sslStatus, verificationStatus, cnameVerified, active, errors } = evaluateStatusTransitions(cfData);

    const domainId = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO custom_domains (
          id, org_id, hostname, cf_custom_hostname_id, ssl_status, verification_status,
          verification_errors, ownership_verification, ssl_verification,
          cname_target, cname_verified, active, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
      )
      .bind(
        domainId,
        orgId,
        hostname,
        cfData.id,
        sslStatus,
        verificationStatus,
        JSON.stringify(errors),
        JSON.stringify(ownership ?? {}),
        JSON.stringify(sslDcv ?? {}),
        DEFAULT_CNAME_TARGET,
        cnameVerified ? 1 : 0,
        active ? 1 : 0,
        now,
        now,
      )
      .run();

    const created = await getCustomDomainById(db, domainId);
    if (!created) {
      return failure({ code: 'INTERNAL', message: 'Failed to retrieve created domain record' });
    }

    invalidateTenantBrandingCache(hostname, orgId);

    logger.info('[CustomDomain] Successfully registered custom domain', {
      domainId,
      orgId,
      hostname,
      sslStatus,
    });

    return success(created);
  } catch (err) {
    const error = toError(err);
    logger.error('[CustomDomain] registerCustomDomainAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * List all custom domains registered for an organization.
 */
export async function listCustomDomainsAction(
  orgId: string,
): Promise<Result<CustomDomainRecord[], CustomDomainError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database unavailable' });
    }

    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) return auth;

    const domains = await listCustomDomainsByOrg(db, orgId);
    return success(domains);
  } catch (err) {
    const error = toError(err);
    logger.error('[CustomDomain] listCustomDomainsAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

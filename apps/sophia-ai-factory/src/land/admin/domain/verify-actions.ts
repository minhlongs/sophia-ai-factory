'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  DomainVerificationResult,
  CustomDomainError,
} from '@/seed/types/custom-domains';
import {
  fetchCloudflareCustomHostname,
  deleteCloudflareCustomHostname,
  parseOwnershipVerification,
  parseSslDcvVerification,
  evaluateStatusTransitions,
  getCustomDomainById,
} from '@/tree/custom-domains/verification-service';
import { invalidateTenantBrandingCache } from '@/tree/branding/org-branding-repo';
import { assertMasterTierAndOrgAccess } from './domain-access';

/**
 * Triggers status re-check against Cloudflare and updates D1.
 */
export async function verifyCustomDomainStatusAction(
  orgId: string,
  domainId: string,
): Promise<Result<DomainVerificationResult, CustomDomainError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database unavailable' });
    }

    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) return auth;

    const domain = await getCustomDomainById(db, domainId);
    if (!domain || domain.org_id !== orgId) {
      return failure({ code: 'NOT_FOUND', message: 'Custom domain not found for this organization' });
    }

    if (!domain.cf_custom_hostname_id) {
      return failure({ code: 'INTERNAL', message: 'Domain lacks Cloudflare Custom Hostname ID' });
    }

    const cfResult = await fetchCloudflareCustomHostname(domain.cf_custom_hostname_id, domain.hostname);
    if (!cfResult.ok) return cfResult;

    const cfData = cfResult.value;
    const ownership = parseOwnershipVerification(cfData);
    const sslDcv = parseSslDcvVerification(cfData);
    const { sslStatus, verificationStatus, cnameVerified, active, errors } = evaluateStatusTransitions(cfData);

    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `UPDATE custom_domains SET
          ssl_status = ?1,
          verification_status = ?2,
          verification_errors = ?3,
          ownership_verification = ?4,
          ssl_verification = ?5,
          cname_verified = ?6,
          active = ?7,
          updated_at = ?8
        WHERE id = ?9 AND org_id = ?10`
      )
      .bind(
        sslStatus,
        verificationStatus,
        JSON.stringify(errors),
        JSON.stringify(ownership ?? {}),
        JSON.stringify(sslDcv ?? {}),
        cnameVerified ? 1 : 0,
        active ? 1 : 0,
        now,
        domainId,
        orgId,
      )
      .run();

    invalidateTenantBrandingCache(domain.hostname, orgId);

    const verificationResult: DomainVerificationResult = {
      domainId,
      hostname: domain.hostname,
      sslStatus,
      verificationStatus,
      cnameVerified,
      active,
      ownershipVerification: ownership,
      sslVerification: sslDcv,
      errors,
      cnameTarget: domain.cname_target,
    };

    logger.info('[CustomDomain] Status verified', {
      domainId,
      hostname: domain.hostname,
      sslStatus,
      active,
    });

    return success(verificationResult);
  } catch (err) {
    const error = toError(err);
    logger.error('[CustomDomain] verifyCustomDomainStatusAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

/**
 * Delete a custom domain from Cloudflare and D1.
 */
export async function deleteCustomDomainAction(
  orgId: string,
  domainId: string,
): Promise<Result<{ success: boolean; domainId: string }, CustomDomainError>> {
  try {
    const db = await getD1();
    if (!db) {
      return failure({ code: 'DB_UNAVAILABLE', message: 'D1 database unavailable' });
    }

    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) return auth;

    const domain = await getCustomDomainById(db, domainId);
    if (!domain || domain.org_id !== orgId) {
      return failure({ code: 'NOT_FOUND', message: 'Custom domain not found for this organization' });
    }

    if (domain.cf_custom_hostname_id) {
      const cfDelete = await deleteCloudflareCustomHostname(domain.cf_custom_hostname_id);
      if (!cfDelete.ok) {
        logger.warn('[CustomDomain] Cloudflare deletion failed, proceeding with DB cleanup', {
          domainId,
          cfCustomHostnameId: domain.cf_custom_hostname_id,
        });
      }
    }

    await db
      .prepare('DELETE FROM custom_domains WHERE id = ?1 AND org_id = ?2')
      .bind(domainId, orgId)
      .run();

    invalidateTenantBrandingCache(domain.hostname, orgId);

    logger.info('[CustomDomain] Successfully deleted custom domain', { domainId, orgId });

    return success({ success: true, domainId });
  } catch (err) {
    const error = toError(err);
    logger.error('[CustomDomain] deleteCustomDomainAction failed', error);
    return failure({ code: 'INTERNAL', message: error.message });
  }
}

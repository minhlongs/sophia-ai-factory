/**
 * Server Actions for Custom Domain Administration (MASTER-tier only).
 *
 * Layer: land (Public business layer)
 * Dependencies: @/seed/*, @/tree/*
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type {
  CustomDomainRecord,
  DomainVerificationResult,
  CustomDomainError,
} from '@/seed/types/custom-domains';
import {
  createCloudflareCustomHostname,
  fetchCloudflareCustomHostname,
  deleteCloudflareCustomHostname,
  parseOwnershipVerification,
  parseSslDcvVerification,
  evaluateStatusTransitions,
  getCustomDomainById,
  getCustomDomainByHostname,
  listCustomDomainsByOrg,
  DEFAULT_CNAME_TARGET,
} from '@/tree/custom-domains/verification-service';
import { invalidateTenantBrandingCache } from '@/tree/branding/org-branding-repo';

// ── Hostname Validation ───────────────────────────────────────────────────────

const HOSTNAME_REGEX = /^(?!-)(?:(?!-)[a-zA-Z0-9-]{1,63}(?<!-)\.)+[a-zA-Z]{2,63}$/i;
const FORBIDDEN_DOMAINS = new Set([
  'sophia.agencyos.network',
  'agencyos.network',
  'localhost',
  'workers.dev',
  'pages.dev',
]);

export function validateHostname(hostname: string): Result<string, CustomDomainError> {
  const normalized = hostname.trim().toLowerCase();

  if (!normalized || normalized.length < 4 || normalized.length > 253) {
    return failure({
      code: 'INVALID_HOSTNAME',
      message: 'Hostname length must be between 4 and 253 characters',
    });
  }

  // Check forbidden/reserved platform domains first so reserved names like localhost fail with appropriate error
  for (const forbidden of FORBIDDEN_DOMAINS) {
    if (normalized === forbidden || normalized.endsWith(`.${forbidden}`)) {
      return failure({
        code: 'INVALID_HOSTNAME',
        message: 'Cannot register root platform domains or internal reserved hostnames',
      });
    }
  }

  if (!HOSTNAME_REGEX.test(normalized)) {
    return failure({
      code: 'INVALID_HOSTNAME',
      message: 'Invalid hostname format. Must be a valid Fully Qualified Domain Name (e.g., portal.myagency.com)',
    });
  }

  return success(normalized);
}

// ── Authorization & MASTER Tier Guard ─────────────────────────────────────────

export async function assertMasterTierAndOrgAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<{ userId: string; isAdmin: boolean }, CustomDomainError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);

  // Platform admins bypass org check and tier requirements
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, isAdmin: true });
  }

  // 1. Verify user is a member of the organization with owner or admin role
  const member = await db
    .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Only organization owners or admins can manage custom domains',
    });
  }

  // 2. Enforce MASTER tier requirement
  const tier = await getUserTier(user.id);
  const orgSub = await db
    .prepare("SELECT tier, plan FROM subscriptions WHERE org_id = ?1 AND status = 'active' LIMIT 1")
    .bind(orgId)
    .first<{ tier: string | null; plan: string | null }>();

  const isMaster =
    tier === 'MASTER' ||
    orgSub?.tier === 'MASTER' ||
    orgSub?.plan?.toLowerCase() === 'master';

  if (!isMaster) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Custom domains require a MASTER tier subscription ($4,999 lifetime license)',
    });
  }

  return success({ userId: user.id, isAdmin: false });
}

// ── Server Actions ────────────────────────────────────────────────────────────

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

    // 1. Validate hostname
    const hostValidation = validateHostname(rawHostname);
    if (!hostValidation.ok) return hostValidation;
    const hostname = hostValidation.value;

    // 2. Authorize caller & verify MASTER tier
    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) return auth;

    // 3. Check for existing registration in D1
    const existing = await getCustomDomainByHostname(db, hostname);
    if (existing) {
      return failure({
        code: 'CONFLICT',
        message: `Hostname '${hostname}' is already registered`,
      });
    }

    // 4. Register custom hostname with Cloudflare for SaaS
    const cfResult = await createCloudflareCustomHostname(hostname);
    if (!cfResult.ok) return cfResult;

    const cfData = cfResult.value;
    const ownership = parseOwnershipVerification(cfData);
    const sslDcv = parseSslDcvVerification(cfData);
    const { sslStatus, verificationStatus, cnameVerified, active, errors } = evaluateStatusTransitions(cfData);

    // 5. Persist to D1
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

    // 1. Authorize caller & verify MASTER tier
    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) return auth;

    // 2. Lookup existing domain
    const domain = await getCustomDomainById(db, domainId);
    if (!domain || domain.org_id !== orgId) {
      return failure({ code: 'NOT_FOUND', message: 'Custom domain not found for this organization' });
    }

    if (!domain.cf_custom_hostname_id) {
      return failure({ code: 'INTERNAL', message: 'Domain lacks Cloudflare Custom Hostname ID' });
    }

    // 3. Query Cloudflare Custom Hostnames endpoint
    const cfResult = await fetchCloudflareCustomHostname(domain.cf_custom_hostname_id, domain.hostname);
    if (!cfResult.ok) return cfResult;

    const cfData = cfResult.value;
    const ownership = parseOwnershipVerification(cfData);
    const sslDcv = parseSslDcvVerification(cfData);
    const { sslStatus, verificationStatus, cnameVerified, active, errors } = evaluateStatusTransitions(cfData);

    const now = Math.floor(Date.now() / 1000);

    // 4. Update D1
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
        WHERE id = ?9 AND org_id = ?10`,
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

    // 1. Authorize caller
    const auth = await assertMasterTierAndOrgAccess(db, orgId);
    if (!auth.ok) return auth;

    // 2. Lookup existing domain
    const domain = await getCustomDomainById(db, domainId);
    if (!domain || domain.org_id !== orgId) {
      return failure({ code: 'NOT_FOUND', message: 'Custom domain not found for this organization' });
    }

    // 3. Delete from Cloudflare (if ID exists)
    if (domain.cf_custom_hostname_id) {
      const cfDelete = await deleteCloudflareCustomHostname(domain.cf_custom_hostname_id);
      if (!cfDelete.ok) {
        logger.warn('[CustomDomain] Cloudflare deletion failed, proceeding with DB cleanup', {
          domainId,
          cfCustomHostnameId: domain.cf_custom_hostname_id,
        });
      }
    }

    // 4. Delete from D1
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

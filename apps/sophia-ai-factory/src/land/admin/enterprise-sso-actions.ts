/**
 * Server Actions for Enterprise Multi-Org SSO Administration
 *
 * Layer: land (Public business layer)
 * Dependencies: @/seed/*, @/tree/*
 *
 * @module land/admin/enterprise-sso-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseSsoConfig,
  CreateEnterpriseSsoInput,
  IdpRoutingMetadata,
  SsoActionError,
} from '@/seed/types/enterprise-sso';
import {
  getEnterpriseSsoByOrg,
  saveEnterpriseSsoConfig,
  deleteEnterpriseSsoConfig,
  resolveIdpRouting,
  normalizeCorporateDomain,
} from '@/tree/sso/enterprise-sso-service';
import { recordEnterpriseAuditEvent } from '@/tree/audit/enterprise-audit-vault';
import { AUDIT_ACTIONS } from '@/seed/types/enterprise-audit';

// ── Authorization Guard ───────────────────────────────────────────────────────

async function assertEnterpriseSsoAccess(
  db: D1Database,
  orgId: string,
): Promise<Result<{ userId: string; userEmail: string; isAdmin: boolean }, SsoActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, userEmail: user.email, isAdmin: true });
  }

  // Check org membership
  const isSoloOrg = orgId === `org-${user.id}`;
  const member = await db
    .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(orgId, user.id)
    .first<{ role: string }>();

  const isOwnerOrAdmin = isSoloOrg || (member && (member.role === 'owner' || member.role === 'admin' || member.role === 'enterprise_admin'));

  if (!isOwnerOrAdmin) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Only organization administrators can manage Enterprise SSO configurations',
    });
  }

  // Tier check: ENTERPRISE or MASTER tier required
  const tier = await getUserTier(user.id);
  const orgSub = await db
    .prepare("SELECT tier, plan FROM subscriptions WHERE org_id = ?1 AND status = 'active' LIMIT 1")
    .bind(orgId)
    .first<{ tier: string | null; plan: string | null }>();

  const isEnterpriseTier =
    tier === 'ENTERPRISE' ||
    tier === 'MASTER' ||
    orgSub?.tier === 'ENTERPRISE' ||
    orgSub?.tier === 'MASTER' ||
    orgSub?.plan?.toLowerCase() === 'enterprise' ||
    orgSub?.plan?.toLowerCase() === 'master';

  if (!isEnterpriseTier) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Enterprise SSO requires an ENTERPRISE or MASTER subscription tier.',
    });
  }

  return success({ userId: user.id, userEmail: user.email, isAdmin: false });
}

// ── Server Actions ────────────────────────────────────────────────────────────

/**
 * Retrieve all SSO configurations for an organization.
 */
export async function getEnterpriseSsoConfigsAction(
  orgId: string,
): Promise<Result<EnterpriseSsoConfig[], SsoActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertEnterpriseSsoAccess(db, orgId);
  if (!auth.ok) {
    return auth;
  }

  try {
    const configs = await getEnterpriseSsoByOrg(db, orgId);
    return success(configs);
  } catch (err) {
    logger.error('[enterprise-sso-actions] Failed to list SSO configs', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to retrieve SSO configurations' });
  }
}

/**
 * Create or update an Enterprise SSO configuration.
 */
export async function saveEnterpriseSsoConfigAction(
  input: CreateEnterpriseSsoInput,
): Promise<Result<EnterpriseSsoConfig, SsoActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertEnterpriseSsoAccess(db, input.orgId);
  if (!auth.ok) {
    return auth;
  }

  try {
    const saved = await saveEnterpriseSsoConfig(db, input);

    // Record tamper-evident audit event
    await recordEnterpriseAuditEvent(db, {
      orgId: input.orgId,
      actorId: auth.value.userId,
      actorEmail: auth.value.userEmail,
      action: AUDIT_ACTIONS.SSO_CONFIGURED,
      resourceType: 'enterprise_sso',
      resourceId: saved.id,
      payload: {
        domain: saved.domain,
        providerType: saved.providerType,
        issuer: saved.issuer,
        clientId: saved.clientId,
        enabled: saved.enabled,
      },
    });

    return success(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[enterprise-sso-actions] Failed to save SSO config', {
      orgId: input.orgId,
      error: message,
    });

    if (message.includes('already claimed')) {
      return failure({ code: 'DOMAIN_CONFLICT', message });
    }
    if (message.includes('Invalid corporate email domain')) {
      return failure({ code: 'INVALID_DOMAIN', message });
    }

    return failure({ code: 'INTERNAL_ERROR', message });
  }
}

/**
 * Delete an Enterprise SSO configuration.
 */
export async function deleteEnterpriseSsoConfigAction(
  orgId: string,
  configId: string,
): Promise<Result<boolean, SsoActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertEnterpriseSsoAccess(db, orgId);
  if (!auth.ok) {
    return auth;
  }

  try {
    const deleted = await deleteEnterpriseSsoConfig(db, configId, orgId);

    if (deleted) {
      await recordEnterpriseAuditEvent(db, {
        orgId,
        actorId: auth.value.userId,
        actorEmail: auth.value.userEmail,
        action: AUDIT_ACTIONS.SSO_DELETED,
        resourceType: 'enterprise_sso',
        resourceId: configId,
        payload: { configId },
      });
    }

    return success(deleted);
  } catch (err) {
    logger.error('[enterprise-sso-actions] Failed to delete SSO config', {
      orgId,
      configId,
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to delete SSO configuration' });
  }
}

/**
 * Lookup IdP routing info for an email address (used during login redirection).
 * Publicly callable to allow unauthenticated corporate users to discover their IdP.
 */
export async function checkEmailSsoRoutingAction(
  email: string,
): Promise<Result<IdpRoutingMetadata | null, SsoActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const normalized = normalizeCorporateDomain(email);
  if (!normalized) {
    return success(null);
  }

  try {
    const routing = await resolveIdpRouting(db, email);
    return success(routing);
  } catch (err) {
    logger.error('[enterprise-sso-actions] Failed to resolve IdP routing', {
      email,
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to resolve corporate login routing' });
  }
}

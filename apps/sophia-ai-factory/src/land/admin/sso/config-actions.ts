'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseSsoConfig,
  CreateEnterpriseSsoInput,
  SsoActionError,
} from '@/seed/types/enterprise-sso';
import {
  getEnterpriseSsoByOrg,
  saveEnterpriseSsoConfig,
  deleteEnterpriseSsoConfig,
} from '@/tree/sso/enterprise-sso-service';
import { recordEnterpriseAuditEvent } from '@/tree/audit/enterprise-audit-vault';
import { AUDIT_ACTIONS } from '@/seed/types/enterprise-audit';
import { assertEnterpriseSsoAccess } from './auth-guard';

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

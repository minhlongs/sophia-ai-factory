/**
 * Audit and error mapping helpers for Enterprise SSO configuration Server Actions.
 * @module land/admin/sso/config-action-helpers
 */

import type { D1Database } from '@cloudflare/workers-types';
import { failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseSsoConfig,
  SsoActionError,
} from '@/seed/types/enterprise-sso';
import { recordEnterpriseAuditEvent } from '@/tree/audit/enterprise-audit-vault';
import { AUDIT_ACTIONS } from '@/seed/types/enterprise-audit';

export async function recordSsoConfigSavedAudit(
  db: D1Database,
  orgId: string,
  actor: { userId: string; userEmail: string },
  saved: EnterpriseSsoConfig,
): Promise<void> {
  await recordEnterpriseAuditEvent(db, {
    orgId,
    actorId: actor.userId,
    actorEmail: actor.userEmail,
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
}

export async function recordSsoConfigDeletedAudit(
  db: D1Database,
  orgId: string,
  actor: { userId: string; userEmail: string },
  configId: string,
): Promise<void> {
  await recordEnterpriseAuditEvent(db, {
    orgId,
    actorId: actor.userId,
    actorEmail: actor.userEmail,
    action: AUDIT_ACTIONS.SSO_DELETED,
    resourceType: 'enterprise_sso',
    resourceId: configId,
    payload: { configId },
  });
}

export function mapSaveSsoConfigError(
  orgId: string,
  err: unknown,
): Result<never, SsoActionError> {
  const message = err instanceof Error ? err.message : String(err);
  logger.error('[enterprise-sso-actions] Failed to save SSO config', {
    orgId,
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

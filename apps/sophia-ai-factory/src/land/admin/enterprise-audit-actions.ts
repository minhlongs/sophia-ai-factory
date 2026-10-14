'use server';

/**
 * Enterprise Cryptographic Audit Vault — Server Actions
 *
 * Exposes read/verify/record actions for the SHA-256 hash-chained Enterprise Audit Vault.
 * Enforces Enterprise RBAC (`canViewAuditVault`) or platform admin privileges.
 *
 * @module land/admin/enterprise-audit-actions
 */

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  queryEnterpriseAuditEvents,
  verifyEnterpriseAuditChain,
  recordEnterpriseAuditEvent,
  type AuditFilterOptions,
  type EnterpriseAuditEvent,
  type ChainVerificationResult,
  type RecordEnterpriseAuditInput,
} from '@/tree/audit/enterprise-audit-vault';
import {
  assertAuditVaultAccess,
  type AuditActionError,
} from './enterprise-audit-auth';

export type { AuditActionError } from './enterprise-audit-auth';

/**
 * Queries enterprise audit events with filters and pagination.
 */
export async function queryEnterpriseAuditEventsAction(
  filters: AuditFilterOptions = {},
): Promise<Result<{ events: EnterpriseAuditEvent[]; total: number }, AuditActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertAuditVaultAccess(db, filters.orgId);
  if (!auth.ok) {
    return auth;
  }

  try {
    const result = await queryEnterpriseAuditEvents(db, filters);
    return success(result);
  } catch (err) {
    logger.error('[enterprise-audit-actions] Failed to query audit events', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to retrieve audit events' });
  }
}

/**
 * Executes cryptographic verification of the audit hash chain.
 * Pinpoints any tampering or broken link in the ledger history.
 */
export async function verifyEnterpriseAuditChainAction(
  orgId?: string,
): Promise<Result<ChainVerificationResult, AuditActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertAuditVaultAccess(db, orgId);
  if (!auth.ok) {
    return auth;
  }

  try {
    const verification = await verifyEnterpriseAuditChain(db, orgId);
    return success(verification);
  } catch (err) {
    logger.error('[enterprise-audit-actions] Failed to verify audit chain', {
      orgId,
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Audit chain verification encountered an error' });
  }
}

/**
 * Record a critical enterprise action to the audit vault.
 */
export async function recordEnterpriseAuditEventAction(
  input: RecordEnterpriseAuditInput,
): Promise<Result<EnterpriseAuditEvent, AuditActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  try {
    const event = await recordEnterpriseAuditEvent(db, {
      ...input,
      actorId: user.id,
      actorEmail: user.email,
    });
    return success(event);
  } catch (err) {
    logger.error('[enterprise-audit-actions] Failed to record audit event', {
      action: input.action,
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to record audit event' });
  }
}

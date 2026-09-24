/**
 * Server Actions for Cryptographic Audit Vault Administration
 *
 * Layer: land (Public business layer)
 * Dependencies: @/seed/*, @/tree/*
 *
 * @module land/admin/enterprise-audit-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  EnterpriseAuditEvent,
  ChainVerificationResult,
  AuditFilterOptions,
  RecordEnterpriseAuditInput,
} from '@/seed/types/enterprise-audit';
import {
  queryEnterpriseAuditEvents,
  verifyEnterpriseAuditChain,
  recordEnterpriseAuditEvent,
} from '@/tree/audit/enterprise-audit-vault';
import { hasEnterprisePermission, type EnterpriseRole } from '@/seed/types/enterprise-rbac';

interface AuditActionError {
  code: string;
  message: string;
}

// ── Authorization Guard ───────────────────────────────────────────────────────

async function assertAuditVaultAccess(
  db: D1Database,
  orgId?: string,
): Promise<Result<{ userId: string; userEmail: string; isAdmin: boolean }, AuditActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, userEmail: user.email, isAdmin: true });
  }

  // Viewing cross-org / global audit trails requires platform admin
  if (!orgId) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Global audit vault inspection requires platform administrator privileges.',
    });
  }

  // Check organization access
  const isSoloOrg = orgId === `org-${user.id}`;
  if (isSoloOrg) {
    return success({ userId: user.id, userEmail: user.email, isAdmin: false });
  }

  const member = await db
    .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!member) {
    return failure({ code: 'FORBIDDEN', message: 'You do not belong to this organization.' });
  }

  // Check traditional roles or enterprise roles
  const role = member.role;
  const isPermittedTraditional =
    role === 'owner' || role === 'admin' || role === 'enterprise_admin' || role === 'creative_director';

  const isPermittedEnterprise =
    role === 'enterprise_admin' ||
    role === 'creative_director' ||
    hasEnterprisePermission(role as EnterpriseRole, 'canViewAuditVault');

  if (!isPermittedTraditional && !isPermittedEnterprise) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Your role lacks permission to view the Cryptographic Audit Vault.',
    });
  }

  return success({ userId: user.id, userEmail: user.email, isAdmin: false });
}

// ── Server Actions ────────────────────────────────────────────────────────────

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

/**
 * Sovereign Data Residency & Cryptographic Compliance Vault: Audit Actions
 *
 * Implements tamper-evident hash chain verification and audit query actions.
 *
 * Layer: land (Public business layer & server actions)
 *
 * @module land/admin/vault-actions/audit-actions
 */

'use server';

import { getD1 } from '@/seed/db/client';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ComplianceAuditLog,
  ChainVerificationResult,
} from '@/seed/types/sovereign-vault';
import {
  verifyComplianceAuditChain,
  queryComplianceAuditLogs,
  type AuditQueryFilters,
} from '@/tree/sovereignty/compliance-ledger';
import { assertVaultAccess } from './auth-guard';
import type { SovereignVaultActionError } from './types';

/**
 * Cryptographically verifies the tamper-evident hash chain for an organization or zone.
 */
export async function verifySovereignComplianceChainAction(
  orgId?: string,
  zoneId?: string,
): Promise<Result<ChainVerificationResult, SovereignVaultActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertVaultAccess(db, orgId);
  if (!auth.ok) return auth;

  try {
    const result = await verifyComplianceAuditChain(db, {
      orgId,
      zoneId,
      signingKeySecret: process.env.SOVEREIGN_COMPLIANCE_KEY,
    });

    return success(result);
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to verify compliance chain', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to verify compliance hash chain' });
  }
}

/**
 * Queries the compliance audit vault with filters and pagination.
 */
export async function querySovereignAuditLogsAction(
  filters: AuditQueryFilters,
): Promise<Result<{ logs: ComplianceAuditLog[]; total: number }, SovereignVaultActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({ code: 'INTERNAL_ERROR', message: 'Database binding unavailable' });
  }

  const auth = await assertVaultAccess(db, filters.orgId ?? undefined);
  if (!auth.ok) return auth;

  try {
    const result = await queryComplianceAuditLogs(db, filters);
    return success(result);
  } catch (err) {
    logger.error('[sovereign-vault-actions] Failed to query compliance logs', {
      error: err instanceof Error ? err.message : String(err),
    });
    return failure({ code: 'INTERNAL_ERROR', message: 'Failed to retrieve compliance audit logs' });
  }
}

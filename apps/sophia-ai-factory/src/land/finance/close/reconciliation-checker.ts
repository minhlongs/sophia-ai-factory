/**
 * Reconciliation & authorization gate helpers
 * @module land/finance/close/reconciliation-checker
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import type { LedgerIntegrityResult, FormS1AuditPack } from '@/seed/types/financial-close';
import { verifyAuditLedgerChain, generateFormS1AuditPack } from '@/tree/finance/merkle-audit-vault';
import { type AuthContext, type FinancialCloseActionError, normalizeErrorArg } from './types';

/**
 * Authentication and administrative authorization gate for financial operations
 */
export async function assertFinanceAdminAccess(): Promise<Result<AuthContext, FinancialCloseActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const { isAdmin } = await isUserAdminWithRole(user);
    if (!isAdmin && user.role !== 'admin') {
      return failure({
        code: 'FORBIDDEN',
        message: 'Financial close operations require CFO, Controller, or Platform Admin privileges.',
      });
    }

    return success({ userId: user.id, userEmail: user.email, isAdmin: true });
  } catch (err) {
    logger.error('Finance auth assertion error', normalizeErrorArg(err));
    return failure({ code: 'AUTH_ERROR', message: 'Failed to verify administrative authorization' });
  }
}

export async function resolveDb(): Promise<Result<D1Database, FinancialCloseActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({
      code: 'DATABASE_UNAVAILABLE',
      message: 'D1 Database binding is currently unavailable.',
    });
  }
  return success(db);
}

export async function executeVerifyAuditVaultIntegrity(
  db: D1Database,
  periodKey?: string,
): Promise<Result<LedgerIntegrityResult, FinancialCloseActionError>> {
  try {
    const result = await verifyAuditLedgerChain(db, periodKey);
    return success(result);
  } catch (err) {
    logger.error('Failed to verify audit vault integrity', normalizeErrorArg(err));
    return failure({
      code: 'VERIFY_INTEGRITY_FAILED',
      message: err instanceof Error ? err.message : 'Audit vault integrity check failed',
    });
  }
}

export async function executeExportFormS1AuditReport(
  db: D1Database,
  periodKey: string,
): Promise<Result<FormS1AuditPack, FinancialCloseActionError>> {
  try {
    const pack = await generateFormS1AuditPack(db, periodKey);
    return success(pack);
  } catch (err) {
    logger.error(`Failed to export Form S-1 audit pack for ${periodKey}`, normalizeErrorArg(err));
    return failure({
      code: 'AUDIT_PACK_EXPORT_FAILED',
      message: err instanceof Error ? err.message : 'Failed to generate Form S-1 audit pack',
    });
  }
}

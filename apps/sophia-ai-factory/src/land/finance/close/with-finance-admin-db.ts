/**
 * Higher-order helper that enforces Finance Admin access and resolves D1 binding.
 * @module land/finance/close/with-finance-admin-db
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Result } from '@/seed/types/result';
import type { AuthContext, FinancialCloseActionError } from './types';
import { assertFinanceAdminAccess, resolveDb } from './reconciliation-checker';

export async function withFinanceAdminDb<T>(
  handler: (db: D1Database, auth: AuthContext) => Promise<Result<T, FinancialCloseActionError>>,
): Promise<Result<T, FinancialCloseActionError>> {
  const authRes = await assertFinanceAdminAccess();
  if (!authRes.ok) return authRes;
  const dbRes = await resolveDb();
  if (!dbRes.ok) return dbRes;
  return handler(dbRes.value, authRes.value);
}

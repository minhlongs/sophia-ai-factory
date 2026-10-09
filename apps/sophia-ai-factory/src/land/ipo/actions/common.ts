/**
 * IPO Management Server Actions Common Helpers & Auth Guards
 *
 * Layer: land/ipo
 *
 * @module land/ipo/actions/common
 */

import type { D1Database } from '@/seed/db/client';
import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';

export interface IpoActionError {
  code: string;
  message: string;
}

export type ActionResult<T> = Result<T, IpoActionError>;

export interface IpoAuthContext {
  userId: string;
  userEmail: string;
  isAdmin: boolean;
}

export function normalizeErrorArg(err: unknown): Error | Record<string, unknown> {
  if (err instanceof Error) return err;
  return { error: String(err) };
}

/**
 * Verifies that the caller has CFO, Controller, Auditor, or Platform Admin privileges.
 */
export async function assertIpoAdminAccess(): Promise<Result<IpoAuthContext, IpoActionError>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return failure({ code: 'UNAUTHORIZED', message: 'Authentication required for IPO filing operations.' });
    }

    const { isAdmin } = await isUserAdminWithRole(user);
    if (!isAdmin && user.role !== 'admin') {
      return failure({
        code: 'FORBIDDEN',
        message: 'IPO filing and SOX 404 governance requires CFO, Controller, Auditor, or Admin privileges.',
      });
    }

    return success({ userId: user.id, userEmail: user.email, isAdmin: true });
  } catch (err) {
    logger.error('IPO admin auth assertion error', normalizeErrorArg(err));
    return failure({ code: 'AUTH_ERROR', message: 'Failed to verify administrative authorization.' });
  }
}

export async function resolveDb(): Promise<Result<D1Database, IpoActionError>> {
  const db = await getD1();
  if (!db) {
    return failure({
      code: 'DATABASE_UNAVAILABLE',
      message: 'Cloudflare D1 Database binding is currently unavailable.',
    });
  }
  return success(db);
}

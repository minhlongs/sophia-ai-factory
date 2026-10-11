import { type User } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import type { ActionError } from './types';

/**
 * Authorization guard: verifies caller is authenticated.
 */
export async function assertAuthenticatedUser(): Promise<Result<User, ActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }
  return success(user);
}

/**
 * Authorization guard: verifies caller has admin privileges.
 */
export async function assertAdminAccess(): Promise<Result<User, ActionError>> {
  const authResult = await assertAuthenticatedUser();
  if (!authResult.ok) return authResult;

  const user = authResult.value;
  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    return failure({
      code: 'FORBIDDEN',
      message: 'Administrative privileges required for mesh operations',
    });
  }

  return success(user);
}

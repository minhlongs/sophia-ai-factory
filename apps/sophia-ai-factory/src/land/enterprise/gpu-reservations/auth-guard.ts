/**
 * Authorization guard for enterprise GPU reservation operations
 *
 * @module land/enterprise/gpu-reservations/auth-guard
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import type { ActionError } from './types';

/**
 * Authorization guard: verifies current user and asserts admin role
 */
export async function assertAdminAccess(): Promise<
  Result<{ userId: string; email: string }, ActionError>
> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    return failure({ code: 'FORBIDDEN', message: 'Enterprise admin privilege required' });
  }

  return success({ userId: user.id, email: user.email });
}

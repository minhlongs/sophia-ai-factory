import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import type { HedgingAdminError } from './types';

/**
 * Asserts that the caller is a platform administrator.
 */
export async function assertAdmin(): Promise<Result<string, HedgingAdminError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Not authenticated' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin) {
    return failure({ code: 'FORBIDDEN', message: 'Platform admin privilege required' });
  }

  return success(user.id);
}

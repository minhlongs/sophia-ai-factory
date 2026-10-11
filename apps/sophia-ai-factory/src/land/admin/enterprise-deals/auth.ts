import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';

/**
 * Asserts that the current session belongs to an authorized admin or platform executive.
 */
export async function assertAdminSession() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED: Authentication required');
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (!isAdmin && user.role !== 'admin') {
    throw new Error('FORBIDDEN: Admin privileges required');
  }

  return user;
}

/**
 * Admin Session Authorization Guard for Integrations Actions
 *
 * Layer: land/integrations/actions
 *
 * @module land/integrations/actions/admin-guard
 */

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';

/**
 * Asserts that the caller is authenticated with admin privileges.
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

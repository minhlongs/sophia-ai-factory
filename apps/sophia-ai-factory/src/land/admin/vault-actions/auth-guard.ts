/**
 * Sovereign Data Residency & Cryptographic Compliance Vault: Auth Guard
 *
 * Layer: land (Public business layer & server actions)
 *
 * @module land/admin/vault-actions/auth-guard
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { success, failure, type Result } from '@/seed/types/result';
import type { AuthContext, SovereignVaultActionError } from './types';

export async function assertVaultAccess(
  db: D1Database,
  orgId?: string,
): Promise<Result<AuthContext, SovereignVaultActionError>> {
  const user = await getCurrentUser();
  if (!user) {
    return failure({ code: 'UNAUTHORIZED', message: 'Authentication required' });
  }

  const { isAdmin } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin') {
    return success({ userId: user.id, userEmail: user.email, isAdmin: true });
  }

  if (!orgId) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Global sovereign vault administration requires platform administrator privileges.',
    });
  }

  // Check solo organization
  if (orgId === `org-${user.id}`) {
    return success({ userId: user.id, userEmail: user.email, isAdmin: false });
  }

  // Check organization membership
  const member = await db
    .prepare('SELECT role FROM org_members WHERE org_id = ?1 AND user_id = ?2 LIMIT 1')
    .bind(orgId, user.id)
    .first<{ role: string }>();

  if (!member) {
    return failure({ code: 'FORBIDDEN', message: 'You do not belong to this organization.' });
  }

  const role = member.role;
  const isPermitted =
    role === 'owner' || role === 'admin' || role === 'enterprise_admin';

  if (!isPermitted) {
    return failure({
      code: 'FORBIDDEN',
      message: 'Your role lacks administrative permission for sovereign vault operations.',
    });
  }

  return success({ userId: user.id, userEmail: user.email, isAdmin: false });
}

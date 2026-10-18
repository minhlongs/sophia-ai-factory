/**
 * Authorization & Validation Helpers for Affiliate Kill Switch Server Actions
 *
 * Layer: land/affiliates/actions (Business Workflow)
 * @module land/affiliates/actions/toggle-kill-switch-auth
 */

import { z } from 'zod';
import type { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { verifyWorkspaceRole } from '@/seed/auth/workspace-access';

export const toggleKillSwitchSchema = z.object({
  active: z.boolean(),
  tenantId: z.string().min(1).max(128).default('default'),
});

export type ToggleKillSwitchInput = z.input<typeof toggleKillSwitchSchema>;

export interface ToggleKillSwitchActionResult {
  tenantId: string;
  killSwitchActive: boolean;
  updatedAt: string;
}

export interface ToggleKillSwitchActionError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'EXECUTION_FAILED';
  message: string;
}

/**
 * Validates whether the authenticated user has administrative control over
 * the specified tenantId (or platform-wide when tenantId is 'default' / platform-scoped).
 */
export async function authorizeTenantOperator(
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>,
  tenantId: string,
): Promise<boolean> {
  // 1. Platform-level admin / operator bypass (DB role or session role)
  const { isAdmin, dbRole } = await isUserAdminWithRole(user);
  if (isAdmin || user.role === 'admin' || dbRole === 'operator' || user.role === 'operator') {
    return true;
  }

  // 2. Platform-wide 'default' tenant requires platform admin/operator privilege
  if (tenantId === 'default') {
    return false;
  }

  // 3. User-owned solo tenant: e.g. tenantId === user.id or org-{user.id}
  if (tenantId === user.id || tenantId === `org-${user.id}` || tenantId === `usr_${user.id}`) {
    return true;
  }

  // 4. Multi-tenant workspace check: requires ADMIN or OWNER role in org
  try {
    const hasOrgAdminRole = await verifyWorkspaceRole(tenantId, user.id, 'ADMIN');
    return hasOrgAdminRole;
  } catch {
    return false;
  }
}

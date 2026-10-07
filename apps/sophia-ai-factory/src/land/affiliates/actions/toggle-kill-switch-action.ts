/**
 * Toggle Affiliate Kill Switch Server Action
 *
 * Authenticated Server Action to immediately engage or disengage the
 * platform-wide or tenant-specific affiliate video generation kill switch.
 *
 * Layer: land/affiliates/actions (Business Workflow)
 * @module land/affiliates/actions/toggle-kill-switch-action
 */

'use server';

import { z } from 'zod';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { verifyWorkspaceRole } from '@/seed/auth/workspace-access';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  setAffiliateKillSwitch,
  isAffiliateKillSwitchActive,
} from '@/tree/affiliate/kill-switch/kill-switch-store';

const toggleKillSwitchSchema = z.object({
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
async function authorizeTenantOperator(
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

export async function toggleAffiliateKillSwitchAction(
  input: ToggleKillSwitchInput,
): Promise<Result<ToggleKillSwitchActionResult, ToggleKillSwitchActionError>> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({
      code: 'UNAUTHORIZED',
      message: 'Authentication required to toggle affiliate kill switch',
    });
  }

  const parsed = toggleKillSwitchSchema.safeParse(input);
  if (!parsed.success) {
    return failure({
      code: 'INVALID_INPUT',
      message: parsed.error.issues.map((i) => i.message).join('; '),
    });
  }

  const { active, tenantId } = parsed.data;

  // Authorization check (BOLA mitigation): user must have admin/operator rights for tenantId
  const isAuthorized = await authorizeTenantOperator(user, tenantId);
  if (!isAuthorized) {
    logger.warn('[security] BOLA blocked: unauthorized attempt to toggle kill switch', {
      userId: user.id,
      tenantId,
      userRole: user.role,
    });
    return failure({
      code: 'FORBIDDEN',
      message: `User ${user.id} is not authorized to toggle kill switch for tenant ${tenantId}`,
    });
  }

  try {
    await setAffiliateKillSwitch(active, tenantId, user.id);

    logger.warn('Affiliate kill switch status updated by operator', {
      tenantId,
      active,
      userId: user.id,
    });

    return success({
      tenantId,
      killSwitchActive: active,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to toggle affiliate kill switch', {
      error: error instanceof Error ? error.message : String(error),
    });
    return failure({
      code: 'EXECUTION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown execution failure',
    });
  }
}

export async function getAffiliateKillSwitchAction(
  tenantId = 'default',
): Promise<Result<{ killSwitchActive: boolean }, ToggleKillSwitchActionError>> {
  const user = await getCurrentUser();
  if (!user?.id) {
    return failure({
      code: 'UNAUTHORIZED',
      message: 'Authentication required to query affiliate kill switch status',
    });
  }

  const isAuthorized = await authorizeTenantOperator(user, tenantId);
  if (!isAuthorized) {
    return failure({
      code: 'FORBIDDEN',
      message: `User ${user.id} is not authorized to inspect kill switch for tenant ${tenantId}`,
    });
  }

  try {
    const active = await isAffiliateKillSwitchActive(tenantId);
    return success({ killSwitchActive: active });
  } catch (error) {
    return failure({
      code: 'EXECUTION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown execution failure',
    });
  }
}

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

import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { success, failure, type Result } from '@/seed/types/result';
import { logger } from '@/seed/utils/logger-utility';
import {
  setAffiliateKillSwitch,
  isAffiliateKillSwitchActive,
} from '@/tree/affiliate/kill-switch/kill-switch-store';
import {
  toggleKillSwitchSchema,
  authorizeTenantOperator,
  type ToggleKillSwitchInput,
  type ToggleKillSwitchActionResult,
  type ToggleKillSwitchActionError,
} from './toggle-kill-switch-auth';

export type {
  ToggleKillSwitchInput,
  ToggleKillSwitchActionResult,
  ToggleKillSwitchActionError,
};

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

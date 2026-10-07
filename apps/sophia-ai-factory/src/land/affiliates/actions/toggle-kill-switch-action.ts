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
  code: 'UNAUTHORIZED' | 'INVALID_INPUT' | 'EXECUTION_FAILED';
  message: string;
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

  try {
    const { active, tenantId } = parsed.data;
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

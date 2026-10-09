/**
 * Playbook Schedule Actions.
 *
 * Layer: land (business workflows / Server Actions)
 * STRICT 4-LAYER BOUNDARY: imports only from @/seed and @/tree.
 *
 * @module land/playbook/actions/schedule-actions
 */

'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { logger } from '@/seed/utils/logger-utility';
import type { ActionResult, SaveScheduleParams } from './types';
import { getDbAccess } from './db-access';
import {
  parseCronIntervalDays,
  upsertRecurringScheduleDb,
  updateScheduleActiveStatus,
} from './schedule-db-helper';

export async function saveRecurringScheduleAction(
  params: SaveScheduleParams,
): Promise<ActionResult<{ scheduleId: string }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    if (!params.workspaceId || !params.blueprintId) {
      return { success: false, error: 'Missing required parameters', code: 'INVALID_INPUT' };
    }

    const { d1, client } = await getDbAccess();
    if (!d1 && !client) {
      return { success: false, error: 'Database not available', code: 'DB_UNAVAILABLE' };
    }

    const scheduleId = params.scheduleId || `sch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const batchSize = Math.max(1, Math.min(params.batchSize || 1, 20));
    const now = Date.now();
    const intervalDays = parseCronIntervalDays(params.scheduleCron || '');
    const nextRunAt = now + intervalDays * 86400 * 1000;
    const nextRunDate = new Date(nextRunAt).toISOString().split('T')[0];

    await upsertRecurringScheduleDb(d1, {
      scheduleId,
      workspaceId: params.workspaceId,
      userId: user.id,
      blueprintId: params.blueprintId,
      scheduleCron: params.scheduleCron,
      batchSize,
      isActive: params.isActive,
      intervalDays,
      nextRunAt,
      nextRunDate,
      now,
    });

    logger.info('[saveRecurringScheduleAction] Schedule saved successfully', {
      scheduleId,
      workspaceId: params.workspaceId,
      blueprintId: params.blueprintId,
      batchSize,
      isActive: params.isActive,
    });

    revalidatePath('/dashboard/playbook');
    revalidatePath('/[locale]/dashboard/playbook');
    revalidateTag('playbook_schedules', 'max');
    return {
      success: true,
      data: { scheduleId },
    };
  } catch (err) {
    logger.error(
      '[saveRecurringScheduleAction] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
      { params },
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save recurring schedule',
      code: 'INTERNAL_ERROR',
    };
  }
}

export async function toggleRecurringScheduleAction(
  scheduleId: string,
  isActive: boolean,
): Promise<ActionResult<{ scheduleId: string; isActive: boolean }>> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' };
    }

    const { d1, client } = await getDbAccess();
    if (!d1 && !client) {
      return { success: false, error: 'Database not available', code: 'DB_UNAVAILABLE' };
    }

    const now = Date.now();
    await updateScheduleActiveStatus(d1, client, scheduleId, isActive, now);

    revalidatePath('/dashboard/playbook');
    revalidatePath('/[locale]/dashboard/playbook');
    revalidateTag('playbook_schedules', 'max');
    return {
      success: true,
      data: { scheduleId, isActive },
    };
  } catch (err) {
    logger.error(
      '[toggleRecurringScheduleAction] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
      { scheduleId, isActive },
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to toggle schedule status',
      code: 'INTERNAL_ERROR',
    };
  }
}

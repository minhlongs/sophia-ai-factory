import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ScheduledCampaignRow,
  ScheduleCreateInput,
} from './types';

export {
  updateScheduleForUser,
  deleteScheduleForUser,
} from './repository-mutations';

export interface ScheduleQueryResult<T> {
  data?: T;
  error?: string;
  code?: 'UNAUTHORIZED' | 'TABLE_NOT_FOUND' | 'NOT_FOUND' | 'INTERNAL_ERROR';
}

export async function listSchedulesForUser(
  userId: string,
): Promise<ScheduleQueryResult<ScheduledCampaignRow[]>> {
  const db = createServerClient();
  const { data, error } = await db
    .from('scheduled_campaigns')
    .select('*')
    .eq('user_id', userId)
    .order('next_run_date', { ascending: true });

  if (error) {
    if (error.code === 'TABLE_NOT_FOUND' || error.message?.includes('no such table')) {
      return { data: [] };
    }
    logger.error('[api/schedule] DB error', new Error(error.message));
    return { error: 'Failed to fetch schedules', code: 'INTERNAL_ERROR' };
  }

  return { data: (data as unknown as ScheduledCampaignRow[]) ?? [] };
}

export async function createScheduleForUser(
  userId: string,
  input: ScheduleCreateInput,
): Promise<ScheduleQueryResult<ScheduledCampaignRow>> {
  const { topic, template_script, interval_days, next_run_date } = input;
  const db = createServerClient();
  const { data, error } = await db
    .from('scheduled_campaigns')
    .insert({
      user_id: userId,
      topic,
      template_script: template_script ?? null,
      interval_days: interval_days ?? 7,
      next_run_date,
      is_active: 1,
    })
    .returning('*');

  if (error) {
    if (error.code === 'TABLE_NOT_FOUND' || error.message?.includes('no such table')) {
      return { error: 'Schedule table not initialized', code: 'TABLE_NOT_FOUND' };
    }
    logger.error('[api/schedule] Insert error', new Error(error.message));
    return { error: 'Failed to create schedule', code: 'INTERNAL_ERROR' };
  }

  const row = data?.[0];
  return { data: row as unknown as ScheduledCampaignRow };
}

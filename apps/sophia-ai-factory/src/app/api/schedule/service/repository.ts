import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import type {
  ScheduledCampaignRow,
  ScheduleCreateInput,
  SchedulePatchInput,
} from './types';

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

export async function updateScheduleForUser(
  userId: string,
  input: SchedulePatchInput,
): Promise<ScheduleQueryResult<ScheduledCampaignRow>> {
  const { id, is_active, interval_days, next_run_date, topic } = input;
  const updateData: Record<string, unknown> = {};

  if (typeof is_active === 'boolean') updateData.is_active = is_active ? 1 : 0;
  if (typeof interval_days === 'number') updateData.interval_days = interval_days;
  if (typeof next_run_date === 'string') updateData.next_run_date = next_run_date;
  if (typeof topic === 'string') updateData.topic = topic;

  const db = createServerClient();
  const { data, error } = await db
    .from('scheduled_campaigns')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', userId)
    .returning('*');

  if (error) {
    if (error.code === 'TABLE_NOT_FOUND') {
      return { error: 'Schedule table not initialized', code: 'TABLE_NOT_FOUND' };
    }
    logger.error('[api/schedule] Update error', new Error(error.message));
    return { error: 'Failed to update schedule', code: 'INTERNAL_ERROR' };
  }

  const row = data?.[0];
  if (!row) {
    return { error: 'Not found', code: 'NOT_FOUND' };
  }

  return { data: row as unknown as ScheduledCampaignRow };
}

export async function deleteScheduleForUser(
  userId: string,
  scheduleId: string,
): Promise<ScheduleQueryResult<boolean>> {
  const db = createServerClient();
  const { data: existing, error: lookupError } = await db
    .from('scheduled_campaigns')
    .select('id')
    .eq('id', scheduleId)
    .eq('user_id', userId)
    .maybeSingle();

  if (lookupError) {
    if (lookupError.code === 'TABLE_NOT_FOUND') {
      return { error: 'Schedule table not initialized', code: 'TABLE_NOT_FOUND' };
    }
    logger.error('[api/schedule] Delete lookup error', new Error(lookupError.message));
    return { error: 'Failed to delete schedule', code: 'INTERNAL_ERROR' };
  }

  if (!existing) {
    return { error: 'Not found', code: 'NOT_FOUND' };
  }

  const { error } = await db
    .from('scheduled_campaigns')
    .delete()
    .eq('id', scheduleId)
    .eq('user_id', userId);

  if (error) {
    if (error.code === 'TABLE_NOT_FOUND') {
      return { error: 'Schedule table not initialized', code: 'TABLE_NOT_FOUND' };
    }
    logger.error('[api/schedule] Delete error', new Error(error.message));
    return { error: 'Failed to delete schedule', code: 'INTERNAL_ERROR' };
  }

  return { data: true };
}

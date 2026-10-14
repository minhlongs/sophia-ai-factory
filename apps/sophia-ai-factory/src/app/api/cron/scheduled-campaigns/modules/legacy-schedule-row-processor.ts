/**
 * Row processing and query helpers for legacy scheduled campaigns.
 * @module app/api/cron/scheduled-campaigns/modules/legacy-schedule-row-processor
 */

import type { D1Client } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import {
  type ScheduledCampaignRow,
  scheduledCampaignRunId,
  isUniqueConstraintError,
  dateOnly,
  addDays,
} from './scheduled-types';

export async function processLegacyScheduleRow(
  schedule: ScheduledCampaignRow,
  today: string,
  db: D1Client,
): Promise<{ created: boolean; failureId?: string }> {
  try {
    const runDate = dateOnly(schedule.next_run_date);
    let insertedCampaign = true;

    const { error: insertError } = await db.from('campaigns').insert({
      id: scheduledCampaignRunId(schedule.id, runDate),
      user_id: schedule.user_id,
      title: `${schedule.topic} — ${runDate}`,
      topic: schedule.topic,
      audience: null,
      script_content: {
        source: 'scheduled_campaign',
        schedule_id: schedule.id,
        script: schedule.template_script ?? '',
      },
      status: 'queued',
      progress: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      if (isUniqueConstraintError(insertError)) {
        insertedCampaign = false;
        logger.info(`[scheduled-campaigns] Campaign already exists for schedule ${schedule.id} on ${runDate}`);
      } else {
        logger.error(`[scheduled-campaigns] Insert failed for schedule ${schedule.id}`, new Error(insertError.message));
        return { created: false, failureId: schedule.id };
      }
    }

    const { data: updatedSchedules, error: updateError } = await db
      .from('scheduled_campaigns')
      .update({
        next_run_date: addDays(today, schedule.interval_days ?? 7),
        last_run_date: runDate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', schedule.id)
      .eq('user_id', schedule.user_id)
      .returning('id');

    if (updateError) {
      logger.error(`[scheduled-campaigns] Schedule advance failed for ${schedule.id}`, new Error(updateError.message));
      return { created: false, failureId: schedule.id };
    }

    if (!updatedSchedules?.[0]) {
      logger.error(
        `[scheduled-campaigns] Schedule advance matched no rows for ${schedule.id}`,
        new Error('Scheduled campaign not found for user'),
      );
      return { created: false, failureId: schedule.id };
    }

    return { created: insertedCampaign };
  } catch (e) {
    logger.error(`[scheduled-campaigns] Failed for schedule ${schedule.id}`, toError(e));
    return { created: false, failureId: schedule.id };
  }
}

export async function fetchLegacySchedules(
  db: D1Client,
  today: string,
): Promise<{ schedules: ScheduledCampaignRow[] | null; tableMissing?: boolean; error?: unknown }> {
  const { data, error } = await db
    .from('scheduled_campaigns')
    .select('*')
    .eq('is_active', 1)
    .lte('next_run_date', today);

  if (error) {
    const msg = (error as { message?: string }).message ?? String(error);
    if (msg.includes('no such table') || msg.includes('relation') || msg.includes('does not exist')) {
      return { schedules: null, tableMissing: true };
    }
    return { schedules: null, error };
  }

  return { schedules: (data ?? []) as unknown as ScheduledCampaignRow[] };
}

import { NextResponse } from 'next/server';
import { createServerClient, type D1Client, type D1Database } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordCronRun } from '@/land/cron/run-tracker';
import {
  finishCronCheckIn,
  failCronCheckIn,
  type CronRunContext,
} from '@/seed/observability/cron-check-in';
import {
  CRON_NAME,
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
        logger.info(
          `[scheduled-campaigns] Campaign already exists for schedule ${schedule.id} on ${runDate}`,
        );
      } else {
        logger.error(
          `[scheduled-campaigns] Insert failed for schedule ${schedule.id}`,
          new Error(insertError.message),
        );
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
      logger.error(
        `[scheduled-campaigns] Schedule advance failed for ${schedule.id}`,
        new Error(updateError.message),
      );
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
    if (
      msg.includes('no such table') ||
      msg.includes('relation') ||
      msg.includes('does not exist')
    ) {
      return { schedules: null, tableMissing: true };
    }
    return { schedules: null, error };
  }

  return { schedules: (data ?? []) as unknown as ScheduledCampaignRow[] };
}

export async function handleLegacyCron(
  today: string,
  d1: D1Database | null,
  cronCtx: CronRunContext,
): Promise<NextResponse> {
  try {
    const db = createServerClient();
    const { schedules, tableMissing, error: fetchError } = await fetchLegacySchedules(db, today);

    if (tableMissing) {
      logger.info('[scheduled-campaigns] Table not yet created — skipping');
      if (d1) await recordCronRun(d1, CRON_NAME, 'success');
      finishCronCheckIn(cronCtx, CRON_NAME);
      return NextResponse.json({
        success: true,
        created: 0,
        message: 'Table not yet available',
      });
    }

    if (!schedules || schedules.length === 0) {
      if (d1) await recordCronRun(d1, CRON_NAME, 'success');
      finishCronCheckIn(cronCtx, CRON_NAME);
      return NextResponse.json({
        success: true,
        created: 0,
        message: 'No scheduled campaigns due',
      });
    }

    if (fetchError) {
      throw fetchError;
    }

    let created = 0;
    const failures: string[] = [];

    for (const schedule of schedules) {
      const res = await processLegacyScheduleRow(schedule, today, db);
      if (res.failureId) {
        failures.push(res.failureId);
      } else if (res.created) {
        created++;
      }
    }

    logger.info(`[scheduled-campaigns] Done: created=${created} failures=${failures.length}`);
    if (d1) {
      await recordCronRun(
        d1,
        CRON_NAME,
        failures.length > 0 ? 'failure' : 'success',
        failures.length > 0 ? `Failed schedules: ${failures.join(', ')}` : undefined,
      );
    }

    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({
      success: true,
      created,
      total: schedules.length,
      failures: failures.length > 0 ? failures : undefined,
    });
  } catch (e) {
    const message = toError(e).message;
    logger.error('[scheduled-campaigns] Cron failed', toError(e));
    if (d1) await recordCronRun(d1, CRON_NAME, 'failure', message);
    failCronCheckIn(cronCtx, CRON_NAME, e);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}

/**
 * Scheduled Campaigns Cron
 *
 * Fires daily and auto-creates campaigns for users who have set up
 * recurring schedules in the `scheduled_campaigns` table.
 *
 * Schedule: Daily 03:00 UTC via Cloudflare Cron Trigger
 * Auth: x-cron-secret header, x-cf-cron: true, or ?token= query param
 *
 * Graceful degradation: returns created:0 if table does not yet exist.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getD1Safe } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import { recordCronRun, wasRecentlyRun } from '@/land/cron/run-tracker';
import { verifyCronAuth } from '@/seed/security/cron-auth';
import {
  startCronCheckIn,
  finishCronCheckIn,
  failCronCheckIn,
} from '@/seed/observability/cron-check-in';

export const dynamic = 'force-dynamic';

const CRON_NAME = 'scheduled-campaigns';
/** Daily — skip if ran within last 12 hours */
const IDEMPOTENCY_WINDOW_MS = 12 * 60 * 60 * 1000;

function scheduledCampaignRunId(scheduleId: string, runDate: string): string {
  return `scheduled_${scheduleId}_${runDate.replace(/-/g, '')}`;
}

function isUniqueConstraintError(error: { message?: string } | null | undefined): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('unique') || message.includes('constraint') || message.includes('primary key');
}

interface ScheduledCampaignRow {
  id: string;
  user_id: string;
  topic: string;
  template_script: string | null;
  interval_days: number | null;
  next_run_date: string;
  is_active: number;
}

export async function GET(req: NextRequest) {
  const authError = verifyCronAuth(req);
  if (authError) return authError;

  const cronCtx = startCronCheckIn(CRON_NAME);
  const d1 = await getD1Safe();

  if (d1 && await wasRecentlyRun(d1, CRON_NAME, IDEMPOTENCY_WINDOW_MS)) {
    finishCronCheckIn(cronCtx, CRON_NAME);
    return NextResponse.json({ ok: true, skipped: 'recent_run' });
  }

  const today = new Date().toISOString().split('T')[0];

  try {
    const db = createServerClient();

    const { data: schedules, error: fetchError } = await db
      .from('scheduled_campaigns')
      .select('*')
      .eq('is_active', 1)
      .lte('next_run_date', today);

    if (fetchError) {
      const msg = fetchError.message ?? String(fetchError);
      if (
        msg.includes('no such table') ||
        msg.includes('relation') ||
        msg.includes('does not exist')
      ) {
        logger.info('[scheduled-campaigns] Table not yet created — skipping');
        if (d1) await recordCronRun(d1, CRON_NAME, 'success');
        finishCronCheckIn(cronCtx, CRON_NAME);
        return NextResponse.json({ success: true, created: 0, message: 'Table not yet available' });
      }
      throw fetchError;
    }

    if (!schedules || schedules.length === 0) {
      if (d1) await recordCronRun(d1, CRON_NAME, 'success');
      finishCronCheckIn(cronCtx, CRON_NAME);
      return NextResponse.json({ success: true, created: 0, message: 'No scheduled campaigns due' });
    }

    let created = 0;
    const failures: string[] = [];

    for (const schedule of schedules as unknown as ScheduledCampaignRow[]) {
      try {
        let insertedCampaign = true;
        const { error: insertError } = await db.from('campaigns').insert({
          id: scheduledCampaignRunId(schedule.id, today),
          user_id: schedule.user_id,
          title: `${schedule.topic} — ${today}`,
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
            logger.info(`[scheduled-campaigns] Campaign already exists for schedule ${schedule.id} on ${today}`);
          } else {
            logger.error(
              `[scheduled-campaigns] Insert failed for schedule ${schedule.id}`,
              new Error(insertError.message)
            );
            failures.push(schedule.id);
            continue;
          }
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + (schedule.interval_days ?? 7));

        const { data: updatedSchedules, error: updateError } = await db
          .from('scheduled_campaigns')
          .update({
            next_run_date: nextDate.toISOString().split('T')[0],
            last_run_date: today,
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
          failures.push(schedule.id);
          continue;
        }

        if (!updatedSchedules?.[0]) {
          logger.error(
            `[scheduled-campaigns] Schedule advance matched no rows for ${schedule.id}`,
            new Error('Scheduled campaign not found for user'),
          );
          failures.push(schedule.id);
          continue;
        }

        if (insertedCampaign) created++;
      } catch (e) {
        logger.error(
          `[scheduled-campaigns] Failed for schedule ${schedule.id}`,
          toError(e)
        );
        failures.push(schedule.id);
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
